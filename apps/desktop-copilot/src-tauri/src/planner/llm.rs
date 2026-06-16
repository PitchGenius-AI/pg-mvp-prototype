//! The live planner (UX_SPEC §5.3, §7). Two haiku jobs, both driving the Messages
//! API directly over `reqwest` (no official Rust SDK) with structured output the way
//! `packages/ai`'s `generateStructured` does — a single `tool_use` tool whose
//! `input_schema` is the output shape, forced via `tool_choice`; we never prompt
//! "respond in JSON":
//!
//! - **Score** (`call`) — each buyer answer → DISC/OCEAN read ("watch it learn",
//!   §5.4). Runs inline inside the PROCESSING beat.
//! - **Generate** (`generate_chain`) — the Phase-2 live cue queue, drawn from the
//!   matched technique's §5.3 repertoire. Runs in a **spawned background task**
//!   ([`LlmPlanner::start_generation`]) so the ~5s round-trip overlaps the current
//!   cue's lifecycle instead of stalling the hero at the flip (the §7 latency lever).
//!   Results land in a shared queue; [`Planner::next_cue`] awaits an in-flight
//!   generation only if the queue is genuinely empty.
//!
//! Latency (§7) is logged per call (`[planner/haiku] …ms`) — see `DECISION.md`.

use std::collections::VecDeque;
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Instant;

use async_trait::async_trait;
use serde::Deserialize;
use serde_json::{json, Value};
use tokio::sync::Notify;

use crate::realtime::{DiscProfile, OceanProfile};

use super::product::SellerProduct;
use super::technique::match_technique;
use super::{
    discovery_cues, grounding, live_engine, script_cues, signal_fallback_cue, MaterialSignal,
    PlannedCue, Planner, ScoreResult, ScoredAnswer,
};

/// A buyer-profile snapshot (DISC, OCEAN, narrative) moved into the spawned
/// generation task — owned, so the task borrows nothing of the planner.
type ProfileSnapshot = (DiscProfile, OceanProfile, String);

const MODEL: &str = "claude-haiku-4-5-20251001";
const ANTHROPIC_URL: &str = "https://api.anthropic.com/v1/messages";
const TOOL_NAME: &str = "emit_buyer_read";
const PLAN_TOOL_NAME: &str = "emit_live_chain";

/// System prompt — grounds the scorer in the §6.2 reads and the hard rule that it
/// scores only from what the buyer actually said (mirrors the product's
/// "AI never invents" rule). Sent with `cache_control: ephemeral` so the repeated
/// per-answer calls hit the prompt cache.
const SYSTEM: &str = "\
You are the live buyer-profiling engine inside a real-time sales-call co-pilot. \
On each turn you receive the discovery question the seller just asked (and its \
off-screen intent), every buyer answer so far this call, and the newest buyer \
answer. Do two things:\n\
1. Decide whether the newest turn ACTUALLY ANSWERS the question. Backchannels, \
   deflections, clarifying questions, or filler ('yeah', 'go on', 'what do you \
   mean?') are NOT answers — set answered=false and the rest is ignored.\n\
2. If it is an answer, score the buyer's DISC (D/I/S/C) and OCEAN (O/C/E/A/N) \
   profile, each 0-100, from the CUMULATIVE evidence across all their answers — so \
   the read firms up over the call. Score only from what the buyer actually said; \
   never invent traits. Set primaryType to the highest DISC axis.\n\
3. Classify the NEWEST buyer turn into exactly one 'materialSignal' label. Be \
   CONSERVATIVE and default to 'none': most discovery answers are NOT signals. A buyer \
   simply DESCRIBING their own situation, pain, goals, process, or numbers while \
   answering the seller's question is 'none' — that is normal discovery, not a signal.\n\
   - 'objection' — the buyer pushes back on YOU or the SOLUTION: doubt it will work, \
     skepticism that it's worth it, distrust, or resistance to moving forward. It is \
     NOT a buyer describing their own problems or pain (that is discovery content).\n\
   - 'buying_signal' — forward intent toward THIS deal: asking how to get started, how \
     soon, about next steps / rollout / a trial, or otherwise signalling readiness to \
     advance.\n\
   - 'new_stakeholder' — the buyer names another decision-maker or influencer (a CFO, a \
     committee, 'my boss') who must be involved and was not previously in play.\n\
   - 'pricing' — the buyer raises the COST, BUDGET, or PRICE OF THIS PURCHASE (what it \
     costs, whether it's affordable, whether it's in budget). It is NOT the buyer's own \
     company revenue, financials, or fundraising figures.\n\
   - 'none' — anything else, INCLUDING normal pain/situation/discovery answers.\n\
   Classify from the newest turn ONLY, and INDEPENDENTLY of 'answered': a buying or \
   pricing QUESTION counts even when it does not answer the seller's question. Pick the \
   single strongest label; when in any doubt, choose 'none'.\n\
Also return a 'takeaway': a terse one-glance success line in the house style \
(e.g. 'read: consensus buyer · COO + ops', 'buying signal · quantified pain'), and \
a one-sentence 'summary' of how to communicate with this buyer.";

/// Hand-written JSON Schema for the tool's `input_schema` — the Rust analog of
/// `zod-to-json-schema(scoreSchema)`. Kept in lockstep with [`ScoreOut`].
fn score_input_schema() -> Value {
    let score = json!({ "type": "integer", "minimum": 0, "maximum": 100 });
    json!({
        "type": "object",
        "properties": {
            "answered": {
                "type": "boolean",
                "description": "Did the newest buyer turn actually answer the question?"
            },
            "disc": {
                "type": "object",
                "properties": {
                    "d": score, "i": score, "s": score, "c": score,
                    "primaryType": { "type": "string", "enum": ["D", "I", "S", "C"] }
                },
                "required": ["d", "i", "s", "c", "primaryType"]
            },
            "ocean": {
                "type": "object",
                "properties": { "o": score, "c": score, "e": score, "a": score, "n": score },
                "required": ["o", "c", "e", "a", "n"]
            },
            "takeaway": { "type": "string", "description": "Terse one-glance success line." },
            "summary": { "type": "string", "description": "One sentence: how to communicate with this buyer." },
            "materialSignal": {
                "type": "string",
                "enum": ["none", "objection", "buying_signal", "new_stakeholder", "pricing"],
                "description": "The single strongest material signal in the newest buyer turn (§5.3), independent of `answered`."
            }
        },
        "required": ["answered", "disc", "ocean", "takeaway", "summary", "materialSignal"]
    })
}

#[derive(Deserialize)]
struct ScoreOut {
    answered: bool,
    disc: DiscOut,
    ocean: OceanOut,
    takeaway: String,
    summary: String,
    #[serde(rename = "materialSignal")]
    material_signal: String,
}

#[derive(Deserialize)]
struct DiscOut {
    d: u32,
    i: u32,
    s: u32,
    c: u32,
    #[serde(rename = "primaryType")]
    primary_type: String,
}

#[derive(Deserialize)]
struct OceanOut {
    o: u32,
    c: u32,
    e: u32,
    a: u32,
    n: u32,
}

/// System prompt for the Phase-2 chain generator (§5.3). Grounds haiku in the
/// matched technique's cue repertoire, the two-tier (trigger + example) format, and
/// the house style — so generated cues look like the scripted ones. Sent with
/// `cache_control: ephemeral` (same sub-1024-token cache-floor caveat as SYSTEM).
const PLAN_SYSTEM: &str = "\
You are the live next-best-task planner inside a real-time sales-call co-pilot, running \
AFTER discovery. You receive the buyer's DISC/OCEAN read, the matched sales technique \
(SPIN, Challenger, or NEPQ) with its confidence tier, and the buyer's recent answers. \
Produce a SHORT queue (2-3) of the next coaching cues for the seller, in priority order, \
drawn from the matched technique's repertoire.\n\
Each cue is TWO-TIER: a glanceable 'trigger' (2-5 words, read at a glance) and a \
full-sentence 'example' the seller can fall back on and rephrase in their own voice (a \
prompt, NOT a verbatim script). Also give an off-screen 'intent' (what a good answer \
reveals — grounds scoring, never shown to the seller) and a terse 'takeaway' success \
line in the house style (e.g. 'buying signal · quantified pain', 'read: consensus buyer').\n\
Technique repertoires:\n\
- SPIN: name the problem · what's it costing (implication) · picture it solved (need-payoff).\n\
- Challenger: reframe their thinking · risk of standing still · take the wheel (recommend the next step).\n\
- NEPQ: soften it · let them name the problem · let them conclude.\n\
Match cues to THIS buyer's profile and what they just said; do not repeat a question they \
already answered. Stay concrete and grounded in their own words.";

/// Hand-written JSON Schema for the generator tool's `input_schema` — a queue of
/// two-tier cues. Kept in lockstep with [`PlanOut`] / [`GenCue`].
fn plan_input_schema() -> Value {
    json!({
        "type": "object",
        "properties": {
            "cues": {
                "type": "array",
                "minItems": 2,
                "maxItems": 3,
                "items": {
                    "type": "object",
                    "properties": {
                        "trigger": { "type": "string", "description": "Glanceable 2-5 word cue." },
                        "example": { "type": "string", "description": "Full-sentence fallback prompt." },
                        "intent": { "type": "string", "description": "Off-screen: what a good answer reveals." },
                        "takeaway": { "type": "string", "description": "Terse house-style success line." }
                    },
                    "required": ["trigger", "example", "intent", "takeaway"]
                }
            }
        },
        "required": ["cues"]
    })
}

#[derive(Deserialize)]
struct PlanOut {
    cues: Vec<GenCue>,
}

#[derive(Deserialize)]
struct GenCue {
    trigger: String,
    example: String,
    intent: String,
    takeaway: String,
}

/// One haiku round-trip forcing a single `tool_use`, returning the tool's `input`
/// Value (the structured-output path `packages/ai`'s `generateStructured` uses). A
/// free fn so the spawned generation task can call it without borrowing the planner;
/// the inline score (`call`) uses it too.
async fn post_tool(
    http: &reqwest::Client,
    api_key: &str,
    system: &str,
    tool_name: &str,
    schema: Value,
    user: String,
) -> Result<Value, String> {
    let body = json!({
        "model": MODEL,
        "max_tokens": 1024,
        "system": [{ "type": "text", "text": system, "cache_control": { "type": "ephemeral" } }],
        "tools": [{
            "name": tool_name,
            "description": "Emit the validated result.",
            "input_schema": schema,
        }],
        "tool_choice": { "type": "tool", "name": tool_name },
        "messages": [{ "role": "user", "content": user }],
    });

    let resp = http
        .post(ANTHROPIC_URL)
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("request failed: {e}"))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let detail = resp.text().await.unwrap_or_default();
        return Err(format!("haiku {status}: {detail}"));
    }

    let v: Value = resp.json().await.map_err(|e| format!("bad json: {e}"))?;
    // Pull the tool_use block's `input` out of the content array.
    v["content"]
        .as_array()
        .and_then(|blocks| blocks.iter().find(|b| b["type"] == "tool_use"))
        .map(|b| b["input"].clone())
        .ok_or_else(|| "no tool_use block in response".to_string())
}

/// One haiku round-trip → a generated Phase-2 chain for the matched `technique`,
/// grounded in the buyer read + recent answers. Free fn so it runs inside the spawned
/// background task. Errors bubble up; [`LlmPlanner::start_generation`] degrades to a
/// canned cue so live coaching never goes dark.
async fn generate_chain(
    http: &reqwest::Client,
    api_key: &str,
    profile: &ProfileSnapshot,
    recent: &str,
    technique: &str,
    tier: &str,
    signal: MaterialSignal,
    product: Option<&SellerProduct>,
    notes: Option<&str>,
) -> Result<Vec<GenCue>, String> {
    let (disc, ocean, summary) = profile;
    // A material re-plan prepends the §5.3 "re-plans toward" direction so the fresh
    // cues are shaped by what the buyer just raised; a steady-state (dry) re-plan
    // passes `None` and this block is empty.
    let signal_block = match signal.as_wire() {
        Some(_) => format!("MATERIAL SIGNAL JUST DETECTED: {}\n\n", signal.replan_hint()),
        None => String::new(),
    };
    // A bound call (PG-292) grounds the cues in what's being sold + the deal context,
    // so the live chain is product- and deal-aware; a cold start passes neither.
    let product_block = match product {
        Some(p) => format!(
            "WHAT THE SELLER SELLS\nProduct: {}\nWhat it is: {}\nIdeal customer: {}\n\
             Problem it solves: {}\n\n",
            p.name, p.description, p.icp, p.problem
        ),
        None => String::new(),
    };
    let notes_block = match notes {
        Some(n) if !n.is_empty() => format!("DEAL CONTEXT\n{n}\n\n"),
        _ => String::new(),
    };
    let user = format!(
        "{signal_block}{product_block}{notes_block}BUYER PROFILE\n\
         DISC: D{} I{} S{} C{} (primary {})\n\
         OCEAN: O{} C{} E{} A{} N{}\n\
         Read: {summary}\n\n\
         MATCHED TECHNIQUE: {technique} (confidence: {tier})\n\n\
         BUYER'S RECENT ANSWERS:\n{recent}",
        disc.d, disc.i, disc.s, disc.c, disc.primary_type,
        ocean.o, ocean.c, ocean.e, ocean.a, ocean.n,
    );
    let input = post_tool(http, api_key, PLAN_SYSTEM, PLAN_TOOL_NAME, plan_input_schema(), user).await?;
    serde_json::from_value::<PlanOut>(input)
        .map(|p| p.cues)
        .map_err(|e| format!("schema mismatch: {e}"))
}

/// Turn generated cues into queued [`PlannedCue`]s, stamping stable `live-N` ids from
/// the shared counter + the live engine-state at the matched tier.
fn build_live_cues(
    cues: Vec<GenCue>,
    technique: &'static str,
    tier: &'static str,
    seq: &AtomicUsize,
) -> Vec<PlannedCue> {
    cues.into_iter()
        .map(|c| {
            let n = seq.fetch_add(1, Ordering::SeqCst) + 1;
            PlannedCue {
                id: format!("live-{n}"),
                phase: "live",
                trigger: c.trigger,
                example: c.example,
                technique: Some(technique),
                intent: c.intent,
                takeaway: c.takeaway,
                engine_on_prompt: live_engine(tier),
            }
        })
        .collect()
}

/// The Anthropic-haiku planner. Scores each buyer answer live and generates the
/// Phase-2 live chain in the **background**, so generation latency never stalls the
/// hero (§7). The cue queue is shared with the spawned generation task
/// ([`Self::start_generation`]); `generating` guards against double-spawn and
/// `notify` wakes a [`Planner::next_cue`] that's waiting on an empty queue.
pub struct LlmPlanner {
    http: reqwest::Client,
    api_key: String,
    queue: Arc<Mutex<VecDeque<PlannedCue>>>,
    answers: Vec<String>,
    last: Option<ProfileSnapshot>,
    /// Shared monotonic counter for stable `live-N` ids across background batches.
    live_seq: Arc<AtomicUsize>,
    /// True while a background generation is in flight (at most one at a time).
    generating: Arc<AtomicBool>,
    /// Notified when a generation finishes pushing cues — wakes a waiting `next_cue`.
    notify: Arc<Notify>,
    /// The current valid generation epoch. A material re-plan ([`Self::force_replan`])
    /// bumps it to invalidate any in-flight steady-state generation: a spawned task
    /// only mutates the shared queue if its captured epoch still matches, so a stale
    /// (superseded) generation discards its result instead of polluting the fresh,
    /// signal-shaped chain. This is what makes "clear the queue + force-start" safe
    /// against the prefetch already running — no double-extend, no lost wake-up.
    gen_epoch: Arc<AtomicUsize>,
    /// The bound deal's product (PG-292), folded into the live-cue generation prompt
    /// so generated cues are grounded in what's being sold. `None` on a cold start.
    /// Seeding it short-circuits the (future) live product match for a bound call.
    product: Option<SellerProduct>,
    /// Free-text deal grounding (known pain/objection + diagnosis blocker) folded
    /// into the generation prompt on a bound call; `None` on a cold start.
    grounding_notes: Option<String>,
}

impl LlmPlanner {
    pub fn discovery(api_key: String) -> Self {
        LlmPlanner {
            http: reqwest::Client::new(),
            api_key,
            queue: Arc::new(Mutex::new(discovery_cues().into_iter().collect())),
            answers: Vec::new(),
            last: None,
            live_seq: Arc::new(AtomicUsize::new(0)),
            generating: Arc::new(AtomicBool::new(false)),
            notify: Arc::new(Notify::new()),
            gen_epoch: Arc::new(AtomicUsize::new(0)),
            product: None,
            grounding_notes: None,
        }
    }

    /// The bound-call planner (PG-292): skip discovery and lead with the prepared
    /// pre-call script as the live queue, seed the prepped buyer read so technique +
    /// generation start warm, and hold the product + grounding notes for the live
    /// cue generator. With a prepped read but no script the queue starts empty and
    /// the first `next_cue` generates straight into live (still skipping discovery);
    /// with neither (precall unavailable) it keeps discovery so the read still builds.
    pub fn grounded(api_key: String, ctx: &grounding::StartCallContext) -> Self {
        let technique = ctx
            .technique
            .as_ref()
            .map(|t| grounding::technique_static(&t.technique))
            .unwrap_or("spin");
        let queue: VecDeque<PlannedCue> = if !ctx.script_sections.is_empty() {
            script_cues(&ctx.script_sections, technique, "locked").into_iter().collect()
        } else if ctx.buyer_profile.is_some() {
            VecDeque::new()
        } else {
            discovery_cues().into_iter().collect()
        };
        let last = ctx
            .buyer_profile
            .as_ref()
            .map(|p| (p.disc.clone(), p.ocean.clone(), p.summary.clone()));
        LlmPlanner {
            http: reqwest::Client::new(),
            api_key,
            queue: Arc::new(Mutex::new(queue)),
            answers: Vec::new(),
            last,
            live_seq: Arc::new(AtomicUsize::new(0)),
            generating: Arc::new(AtomicBool::new(false)),
            notify: Arc::new(Notify::new()),
            gen_epoch: Arc::new(AtomicUsize::new(0)),
            product: ctx.product.clone(),
            grounding_notes: ctx.grounding_notes.clone(),
        }
    }

    /// Kick off a background **steady-state** chain generation if one isn't already
    /// running (the dry-queue / prefetch path). `swap` claims the single slot;
    /// generation runs at the current epoch with no material signal.
    fn start_generation(&self) {
        // One generation at a time — `swap` claims the slot atomically.
        if self.generating.swap(true, Ordering::SeqCst) {
            return;
        }
        let epoch = self.gen_epoch.load(Ordering::SeqCst);
        self.spawn_generation(MaterialSignal::None, epoch);
    }

    /// The material-signal re-plan (§5.3, [`Planner::force_replan`] body). Bumps the
    /// epoch to invalidate any in-flight steady-state generation, clears the queued
    /// (not-yet-surfaced) cues so the freshly-planned head takes the hero, and spawns
    /// a signal-shaped generation at the new epoch. Unlike [`Self::start_generation`]
    /// it does NOT respect the `generating` guard — it deliberately supersedes an
    /// in-flight gen (that task will discard on the stale epoch); the new task owns
    /// `generating` and clears it on completion.
    fn force_replan_inner(&self, signal: MaterialSignal) {
        let epoch = self.gen_epoch.fetch_add(1, Ordering::SeqCst) + 1;
        if let Ok(mut q) = self.queue.lock() {
            q.clear();
        }
        self.generating.store(true, Ordering::SeqCst);
        self.spawn_generation(signal, epoch);
    }

    /// Snapshot everything a generation needs (so the task borrows nothing of `self`),
    /// spawn it, and return immediately. The spawned task only mutates the shared
    /// queue / `generating` flag if its captured `my_epoch` is still current — a
    /// superseded generation (a later [`Self::force_replan_inner`] bumped the epoch)
    /// discards its result. Stall-safe: an empty/failed generation degrades to one
    /// canned cue ([`signal_fallback_cue`] — signal-appropriate, or the technique
    /// fallback when there's no signal).
    fn spawn_generation(&self, signal: MaterialSignal, my_epoch: usize) {
        let (technique, tier) = match &self.last {
            Some((disc, ocean, _)) => {
                let m = match_technique(disc, ocean, self.answers.len());
                (m.technique, m.tier)
            }
            // No read yet (shouldn't happen post-discovery) — neutral default.
            None => ("spin", "suggested"),
        };
        let profile = self.last.clone().unwrap_or_else(|| {
            (
                DiscProfile { d: 50, i: 50, s: 50, c: 50, primary_type: "S".into() },
                OceanProfile { o: 50, c: 50, e: 50, a: 50, n: 50 },
                "Still reading the buyer.".to_string(),
            )
        });
        let recent = self
            .answers
            .iter()
            .rev()
            .take(3)
            .rev()
            .map(|a| format!("- {a}"))
            .collect::<Vec<_>>()
            .join("\n");

        let http = self.http.clone();
        let api_key = self.api_key.clone();
        let queue = self.queue.clone();
        let seq = self.live_seq.clone();
        let generating = self.generating.clone();
        let notify = self.notify.clone();
        let gen_epoch = self.gen_epoch.clone();
        let product = self.product.clone();
        let notes = self.grounding_notes.clone();
        let tag = signal.as_wire().unwrap_or("steady");

        tokio::spawn(async move {
            let started = Instant::now();
            let result = generate_chain(
                &http,
                &api_key,
                &profile,
                &recent,
                technique,
                tier,
                signal,
                product.as_ref(),
                notes.as_deref(),
            )
            .await;
            let ms = started.elapsed().as_millis();
            let cues = match result {
                Ok(cues) if !cues.is_empty() => {
                    eprintln!(
                        "[planner/haiku] replan {ms}ms · {} live cues · {technique}/{tier} · {tag}",
                        cues.len()
                    );
                    build_live_cues(cues, technique, tier, &seq)
                }
                Ok(_) => {
                    eprintln!("[planner/haiku] replan {ms}ms · empty, degrading to canned cue · {tag}");
                    vec![signal_fallback_cue(signal, technique, tier)]
                }
                Err(e) => {
                    eprintln!("[planner/haiku] replan {ms}ms · error, degrading: {e} · {tag}");
                    vec![signal_fallback_cue(signal, technique, tier)]
                }
            };
            // Only the current-epoch generation mutates shared state — a superseded
            // one (a later force_replan bumped the epoch) drops its result so it can't
            // pollute the fresh signal-shaped chain or wrongly clear `generating`.
            if gen_epoch.load(Ordering::SeqCst) == my_epoch {
                if let Ok(mut q) = queue.lock() {
                    q.extend(cues);
                }
                generating.store(false, Ordering::SeqCst);
                notify.notify_one();
            } else {
                eprintln!("[planner/haiku] replan {ms}ms · superseded (epoch {my_epoch}), discarded");
            }
        });
    }

    /// One haiku round-trip → the parsed buyer read. Runs inline (not spawned) inside
    /// the PROCESSING beat. Errors bubble up as `Err`; the caller decides the degrade.
    async fn call(&self, cue: &PlannedCue, buyer_text: &str) -> Result<ScoreOut, String> {
        let prior = if self.answers.is_empty() {
            "(none yet)".to_string()
        } else {
            self.answers
                .iter()
                .enumerate()
                .map(|(i, a)| format!("{}. {a}", i + 1))
                .collect::<Vec<_>>()
                .join("\n")
        };
        let user = format!(
            "QUESTION ASKED (trigger): {}\n\
             QUESTION INTENT (off-screen): {}\n\n\
             BUYER ANSWERS SO FAR:\n{prior}\n\n\
             NEWEST BUYER TURN: {buyer_text}",
            cue.trigger, cue.intent,
        );

        let input =
            post_tool(&self.http, &self.api_key, SYSTEM, TOOL_NAME, score_input_schema(), user)
                .await?;
        serde_json::from_value::<ScoreOut>(input).map_err(|e| format!("schema mismatch: {e}"))
    }
}

#[async_trait]
impl Planner for LlmPlanner {
    /// Pop the head. If the queue is momentarily empty, make sure a generation is
    /// running and await it (rather than block synchronously). The live planner
    /// generates indefinitely, so this never returns `None` — the loop ends only when
    /// the finals channel closes.
    async fn next_cue(&mut self) -> Option<PlannedCue> {
        loop {
            if let Some(c) = self.queue.lock().ok().and_then(|mut q| q.pop_front()) {
                return Some(c);
            }
            if !self.generating.load(Ordering::SeqCst) {
                self.start_generation();
            }
            // `notify_one` stores a permit if the generation finished first, so we
            // can't miss the wake-up; on a spurious wake we just re-check the queue.
            self.notify.notified().await;
        }
    }

    /// Non-blocking latency hint (§7): once the queue empties behind the surfaced
    /// head, start generating the next batch in the background so it's ready before
    /// the head is consumed — the ~5s round-trip overlaps the live conversation
    /// instead of stalling the flip.
    fn prefetch(&mut self) {
        let empty = self.queue.lock().map(|q| q.is_empty()).unwrap_or(false);
        if empty {
            self.start_generation();
        }
    }

    async fn score_answer(&mut self, cue: &PlannedCue, buyer_text: &str) -> ScoreResult {
        let started = Instant::now();
        let result = self.call(cue, buyer_text).await;
        let ms = started.elapsed().as_millis();

        match result {
            Ok(out) if !out.answered => {
                // Not an actual answer — stay in PROCESSING (don't record it as a
                // scored answer). But a material signal still travels: a buying /
                // pricing *question* doesn't answer the cue yet must re-plan (§5.3).
                let signal = MaterialSignal::from_wire(&out.material_signal);
                eprintln!(
                    "[planner/haiku] {ms}ms · not-an-answer (cue {}) · signal {signal:?}",
                    cue.id
                );
                ScoreResult { answer: None, signal }
            }
            Ok(out) => {
                let signal = MaterialSignal::from_wire(&out.material_signal);
                eprintln!(
                    "[planner/haiku] {ms}ms · scored cue {} · {} · signal {signal:?}",
                    cue.id, out.takeaway
                );
                self.answers.push(buyer_text.to_string());
                let disc = DiscProfile {
                    d: out.disc.d,
                    i: out.disc.i,
                    s: out.disc.s,
                    c: out.disc.c,
                    primary_type: out.disc.primary_type,
                };
                let ocean = OceanProfile {
                    o: out.ocean.o,
                    c: out.ocean.c,
                    e: out.ocean.e,
                    a: out.ocean.a,
                    n: out.ocean.n,
                };
                self.last = Some((disc.clone(), ocean.clone(), out.summary.clone()));
                // Rules-match the technique from this same score (free — no extra
                // round-trip); `answers.len()` drives the confidence tier.
                let technique = match_technique(&disc, &ocean, self.answers.len());
                ScoreResult {
                    answer: Some(ScoredAnswer {
                        takeaway: out.takeaway,
                        disc,
                        ocean,
                        summary: out.summary,
                        technique,
                    }),
                    signal,
                }
            }
            Err(e) => {
                // Stall-safe degrade (§5.2 "PROCESSING is short by design"): a
                // transient API error must not freeze the cue. Advance with the
                // cue's canned takeaway and the last good profile (or a neutral
                // starter), and treat the turn as answered. No read ⇒ no signal.
                eprintln!("[planner/haiku] {ms}ms · error, degrading: {e}");
                self.answers.push(buyer_text.to_string());
                let (disc, ocean, summary) = self.last.clone().unwrap_or_else(|| {
                    (
                        DiscProfile { d: 50, i: 50, s: 50, c: 50, primary_type: "S".into() },
                        OceanProfile { o: 50, c: 50, e: 50, a: 50, n: 50 },
                        "Still reading the buyer — connection dropped briefly.".to_string(),
                    )
                });
                let technique = match_technique(&disc, &ocean, self.answers.len());
                ScoreResult {
                    answer: Some(ScoredAnswer {
                        takeaway: cue.takeaway.clone(),
                        disc,
                        ocean,
                        summary,
                        technique,
                    }),
                    signal: MaterialSignal::None,
                }
            }
        }
    }

    /// Material re-plan (§5.3). In the live phase, always act. Mid-discovery (the
    /// deviation Cassandra chose over §5.3's fixed Phase 1), apply the
    /// **profile-completeness guard**: require ≥2 scored discovery answers before a
    /// signal may cut the fixed script short and flip to live, so an early objection
    /// doesn't strand a half-formed buyer read. Below the threshold the signal is
    /// logged but held. Acting clears the queue + force-starts a signal-shaped gen.
    fn force_replan(&mut self, signal: MaterialSignal, in_discovery: bool) -> bool {
        const MIN_READS: usize = 2;
        if in_discovery && self.answers.len() < MIN_READS {
            eprintln!(
                "[planner] material {signal:?} during discovery held — {} read(s), need ≥{MIN_READS}",
                self.answers.len()
            );
            return false;
        }
        eprintln!("[planner] material {signal:?} → force re-plan (flip to live)");
        self.force_replan_inner(signal);
        true
    }
}
