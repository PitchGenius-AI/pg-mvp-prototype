//! The cue lifecycle + planner (UX_SPEC §5.2, §5.3). One loop, two modes: Phase 1
//! is a fixed discovery script (§6.2); Phase 2 is a generated next-best-task chain
//! (the future re-planning `LlmPlanner`). Both run the *same* lifecycle loop
//! ([`run`]); the only difference is which [`Planner`] is behind it.
//!
//! This increment ("advance + live profile") makes the loop **content-aware** and
//! lights up the Buyer panel live:
//!
//! - PROMPT → PROCESSING is gated on the seller voicing *something* (the [QA]
//!   heuristic [`seller_voiced`] — a free question/substance check, not an LLM
//!   call), replacing the old "any seller turn advances".
//! - PROCESSING → SUCCESS is gated on the buyer *actually answering*: the planner's
//!   [`Planner::score_answer`] returns `None` for filler/deflection (stay in
//!   PROCESSING) or `Some(ScoredAnswer)` — a one-glance takeaway **plus** the
//!   re-scored buyer DISC/OCEAN profile, which the loop emits as `profile_update`.
//!
//! The cue *chain* is still the scripted §6.2 discovery script here; only the
//! advance + scoring became content-aware. The [`LlmPlanner`] (Anthropic haiku,
//! [`llm`]) does the real scoring; the [`ScriptedPlanner`] keeps a canned
//! progression so the no-API-key dev run and the browser fixture still work.
//! The fully-generated Phase-2 chain + material-signal re-plan (§5.3) is next.

mod llm;
// The seller product / ICP / problem context (PG-282). Lands the data-layer
// seam; the planner does not read it yet — first readers are PG-284 (skeleton
// grounding) and PG-286 (live product match), which thread it in via start_call.
#[allow(dead_code)]
pub mod product;
mod technique;

use std::collections::VecDeque;
use std::time::Duration;

use async_trait::async_trait;
use tauri::AppHandle;
use tokio::sync::mpsc::UnboundedReceiver;

use crate::realtime::{
    emit, CueEvent, DiscProfile, EngineStateEvent, MaterialSignalEvent, OceanProfile,
    ProfileUpdateEvent, RealtimeEvent, TechniqueUpdateEvent,
};

pub use llm::LlmPlanner;
use technique::{match_technique, TechniqueMatch};

/// A transcript final forwarded from the STT task so the planner can advance the
/// lifecycle. `speaker` drives the turn structure; `text` is the content the
/// heuristic seller gate and the haiku answer-scorer read.
pub struct Final {
    pub speaker: &'static str,
    pub text: String,
}

/// One cue the planner wants surfaced, plus the engine-state to emit just before
/// its PROMPT (the `Discovery n/total` step + confidence creep). Scripting the
/// engine-state here keeps the lifecycle loop ([`run`]) dumb and producer-agnostic.
#[derive(Clone)]
pub struct PlannedCue {
    pub id: String,
    pub phase: &'static str, // "discovery" | "live"
    pub trigger: String,
    pub example: String,
    pub technique: Option<&'static str>,
    /// The off-screen intent (§6.2 "Intent" column) — what a good answer reveals.
    /// Grounds the haiku scorer; never shown to the seller.
    pub intent: String,
    pub takeaway: String, // fallback shown on SUCCESS if the scorer returns none
    pub engine_on_prompt: EngineStateEvent,
}

/// The buyer read produced from a scored answer: the success-line takeaway, the
/// re-scored DISC/OCEAN profile (reusing the wire structs so the loop can emit it
/// straight onto `profile_update`), and the technique matched from that profile by
/// the rules matcher (emitted onto `technique_update`). Returned by
/// [`Planner::score_answer`]; the loop emits both events together so the Buyer and
/// Technique panels fill in lockstep.
pub struct ScoredAnswer {
    pub takeaway: String,
    pub disc: DiscProfile,
    pub ocean: OceanProfile,
    pub summary: String,
    pub technique: TechniqueMatch,
}

/// The four buyer-side material signals (§5.3 catalog) — the labels the buyer-score
/// haiku call now also emits, one per turn, folded into the *same* round-trip (no
/// second classifier call). A material label regenerates the live chain toward the
/// signal. `None` is the steady state (no re-plan). The two seller-side VAD signals
/// (monologue / long silence) are a later increment (B2/B3); this is the buyer half.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum MaterialSignal {
    None,
    Objection,
    BuyingSignal,
    NewStakeholder,
    Pricing,
}

impl MaterialSignal {
    /// Parse the classifier's enum label (the `materialSignal` field on the score
    /// tool). Unknown / "none" → [`MaterialSignal::None`] (no re-plan).
    pub fn from_wire(s: &str) -> Self {
        match s {
            "objection" => MaterialSignal::Objection,
            "buying_signal" => MaterialSignal::BuyingSignal,
            "new_stakeholder" => MaterialSignal::NewStakeholder,
            "pricing" => MaterialSignal::Pricing,
            _ => MaterialSignal::None,
        }
    }

    /// The wire string for the `material_signal` event — `None` for the steady state
    /// (nothing to surface).
    pub fn as_wire(self) -> Option<&'static str> {
        match self {
            MaterialSignal::None => Option::None,
            MaterialSignal::Objection => Some("objection"),
            MaterialSignal::BuyingSignal => Some("buying_signal"),
            MaterialSignal::NewStakeholder => Some("new_stakeholder"),
            MaterialSignal::Pricing => Some("pricing"),
        }
    }

    /// The §5.3 "re-plans toward" direction, fed into the chain-generator prompt so
    /// the freshly-planned cues are shaped by the signal.
    pub fn replan_hint(self) -> &'static str {
        match self {
            MaterialSignal::None => "",
            MaterialSignal::Objection => {
                "The buyer just raised an OBJECTION / resistance. Re-plan toward reframing or \
                 directly handling it: surface the real concern, reframe the status quo, and \
                 de-risk — do not push past the hesitation."
            }
            MaterialSignal::BuyingSignal => {
                "The buyer just gave a BUYING SIGNAL (asking how to start, how soon, or about next \
                 steps). Re-plan toward a trial close and advancing the deal: confirm fit and \
                 propose the concrete next step."
            }
            MaterialSignal::NewStakeholder => {
                "The buyer just named a NEW STAKEHOLDER / decision-maker. Re-plan toward mapping \
                 the decision process and multi-threading: understand the new player's priorities \
                 and how to reach them."
            }
            MaterialSignal::Pricing => {
                "The buyer just raised BUDGET / PRICING. Re-plan toward value and the commercial \
                 conversation: anchor on ROI and the cost of inaction before discussing price."
            }
        }
    }
}

/// What [`Planner::score_answer`] returns: the scored answer (`None` if the buyer
/// turn wasn't actually an answer — stay in PROCESSING) **plus** the material-signal
/// label, which travels *independently* of `answer`. The independence matters: a
/// buying-signal or pricing turn is often phrased as a question ("how soon could we
/// be live?", "what does this cost?") that doesn't *answer* the cue but must still
/// trigger a re-plan — so the signal can't be gated behind `answer.is_some()`.
pub struct ScoreResult {
    pub answer: Option<ScoredAnswer>,
    pub signal: MaterialSignal,
}

/// The pluggable planner interface (§5.3). `next_cue` returns the head of the cue
/// queue (the hero only ever shows the head, §5.1, so churn behind it is invisible);
/// it's `async` because when the queue is momentarily empty it awaits an in-flight
/// background generation rather than blocking the lifecycle — `None` only when there
/// is genuinely nothing more. `score_answer` scores the buyer's reply — `None` means
/// "not actually an answer, stay in PROCESSING". `prefetch` is the latency lever
/// (§7): a *non-blocking* hint, called right after a cue is surfaced, that tops up
/// the live chain in the background if it's running low — so generation (a ~5s haiku
/// round-trip) overlaps the current cue's lifecycle and the next `next_cue` returns
/// instantly instead of stalling the hero. The [`ScriptedPlanner`] walks a fixed
/// queue + one canned live cue (no generation → default no-op prefetch); the
/// [`LlmPlanner`] generates the live chain from the buyer read in a spawned task.
#[async_trait]
pub trait Planner: Send {
    async fn next_cue(&mut self) -> Option<PlannedCue>;
    async fn score_answer(&mut self, cue: &PlannedCue, buyer_text: &str) -> ScoreResult;
    fn prefetch(&mut self) {}
    /// React to a material signal (§5.3): clear the live queue and force-start a
    /// fresh, signal-shaped generation so the next [`next_cue`] returns a re-planned
    /// head (the queued cues are moved out of the way). `in_discovery` lets the
    /// planner apply the profile-completeness guard — a signal mid-discovery only
    /// re-plans (and flips to live) once the buyer read is established enough that
    /// abandoning the rest of the fixed script won't strand a half-formed profile.
    /// Returns whether it actually re-planned. Default no-op (the [`ScriptedPlanner`]
    /// has no live generator): returns `false`.
    fn force_replan(&mut self, _signal: MaterialSignal, _in_discovery: bool) -> bool {
        false
    }
}

/// The live engine-state every Phase-2 cue surfaces with: listening, `live` phase,
/// no discovery counter, technique locked-in at `tier`. Built here so generated and
/// fallback live cues stay consistent.
fn live_engine(tier: &'static str) -> EngineStateEvent {
    EngineStateEvent::new("listening", "live", None, Some(tier))
}

/// A canned Phase-2 cue for the matched `technique` — the §5.3 per-technique cue
/// set, one representative task each. Two jobs: it's the [`ScriptedPlanner`]'s whole
/// live phase (no-API-key dev run + the story the browser fixture tells), and it's
/// the [`LlmPlanner`]'s stall-safe degrade when a generation round-trip fails, so
/// live coaching never goes dark. `id` is stable for one surfacing; the loop reuses
/// it across the cue's lifecycle.
pub fn fallback_live_cue(technique: &'static str, tier: &'static str) -> PlannedCue {
    let (trigger, example, intent, takeaway) = match technique {
        "challenger" => (
            "Risk of standing still",
            "The bigger risk might be standing still while competitors move — worth weighing?",
            "Reframe the status quo as the real risk (Challenger Take-Control). Urgency \
             against inertia is a buying signal.",
            "buying signal · urgency reframed",
        ),
        "nepq" => (
            "Let them name it",
            "What made you start looking at this in the first place?",
            "Let the buyer surface their own problem (NEPQ problem-awareness), neutral \
             tone, low resistance. Their own words are the signal.",
            "buying signal · self-named problem",
        ),
        // SPIN (and any unknown) → the implication question.
        _ => (
            "What's it costing?",
            "If that doesn't change, what does it cost you over the next year?",
            "Quantify the cost of the status quo — a SPIN implication question. A \
             concrete number is a buying signal.",
            "buying signal · quantified pain",
        ),
    };
    PlannedCue {
        id: "live-fallback".into(),
        phase: "live",
        trigger: trigger.into(),
        example: example.into(),
        technique: Some(technique),
        intent: intent.into(),
        takeaway: takeaway.into(),
        engine_on_prompt: live_engine(tier),
    }
}

/// The stall-safe degrade for a **material re-plan** (§5.3): if the signal-shaped
/// generation round-trip fails, fall back to a single canned cue *appropriate to the
/// signal* (objection → surface the concern, buying signal → lock the next step,
/// etc.) rather than a generic technique cue — so even a failed re-plan still moves
/// toward the thing the buyer just raised. `None` falls through to the technique
/// fallback ([`fallback_live_cue`]).
pub fn signal_fallback_cue(
    signal: MaterialSignal,
    technique: &'static str,
    tier: &'static str,
) -> PlannedCue {
    let (id, trigger, example, intent, takeaway) = match signal {
        MaterialSignal::Objection => (
            "live-objection",
            "Name the real concern",
            "It sounds like something there gives you pause — what's the part you're most unsure about?",
            "Surface and reframe the objection; get the true blocker on the table before pushing on.",
            "objection · concern surfaced",
        ),
        MaterialSignal::BuyingSignal => (
            "live-buying",
            "Lock the next step",
            "It sounds like you're ready to move — what would a good next step look like on your side?",
            "Trial-close on the buying signal; convert intent into a committed, concrete next step.",
            "buying signal · next step set",
        ),
        MaterialSignal::NewStakeholder => (
            "live-stakeholder",
            "Map the new player",
            "Good to know — what matters most to them, and how do they like to be brought into a decision?",
            "Multi-thread to the new stakeholder; learn their priorities and the path to reach them.",
            "stakeholder · decision map",
        ),
        MaterialSignal::Pricing => (
            "live-pricing",
            "Anchor on value first",
            "Before we get to price — what's it costing you to stay where you are for another year?",
            "Reframe to value/ROI before the number; anchor the cost of inaction first.",
            "pricing · value anchored",
        ),
        MaterialSignal::None => return fallback_live_cue(technique, tier),
    };
    PlannedCue {
        id: id.into(),
        phase: "live",
        trigger: trigger.into(),
        example: example.into(),
        technique: Some(technique),
        intent: intent.into(),
        takeaway: takeaway.into(),
        engine_on_prompt: live_engine(tier),
    }
}

/// The fixed §6.2 discovery script — the three-cue Phase-1 chain that builds the
/// buyer read from zero. Shared by both planners (the [`LlmPlanner`] reuses it and
/// only changes how each answer is scored). The Phase-2 live chain that follows is
/// generated ([`LlmPlanner::replan`]) or the canned [`fallback_live_cue`]; it is no
/// longer part of this fixed script.
pub fn discovery_cues() -> Vec<PlannedCue> {
    // Wording tracks the §6.2 cues (and the browser fixture). `intent` is the
    // off-screen §6.2 "Intent" column that grounds scoring. All `[QA]`.
    //
    // An introductions opener leads (added 2026-06-09): a real call starts with
    // rapport, not a cold "Why now?". It's scored like any other answer, so the
    // buyer's self-introduction seeds the profile *before* the substantive cues —
    // the read is already forming when the first discovery question lands. (The
    // §6.2 three-cue set still runs in full and still carries the ≥2-reads-per-trait
    // coverage; the intro is an additional, earlier touch, not a replacement —
    // discovery is now four touches, progress `n/4`.)
    vec![
        PlannedCue {
            id: "intro".into(),
            phase: "discovery",
            trigger: "Break the ice".into(),
            example: "Before we dive in — tell me a bit about you and what you're focused on \
                      right now."
                .into(),
            technique: None,
            intent: "Open with rapport and let the buyer introduce themselves. Reads \
                     communication style from how they self-present — warm/talkative (I/E), \
                     brisk and to-the-point (D), precise/measured (C), gracious (A) — and \
                     surfaces their role and what's on their plate."
                .into(),
            takeaway: "read: warming up · style + role".into(),
            engine_on_prompt: EngineStateEvent::new("listening", "discovery", Some((0, 4)), None),
        },
        PlannedCue {
            id: "d1".into(),
            phase: "discovery",
            trigger: "Why now?".into(),
            example: "What made you start looking at this now, of all times?".into(),
            technique: None,
            intent: "What triggered them looking at this now? Reads urgency (D), \
                     specificity (C), whether it's pain-framed (N↑) or opportunity-framed (O↑)."
                .into(),
            takeaway: "read: pain-driven · urgency ↑".into(),
            engine_on_prompt: EngineStateEvent::new(
                "listening",
                "discovery",
                Some((1, 4)),
                Some("suggested"),
            ),
        },
        PlannedCue {
            id: "d2".into(),
            phase: "discovery",
            trigger: "How do they decide? Who's in?".into(),
            example: "Walk me through how a decision like this gets made on your side.".into(),
            technique: None,
            intent: "Their decision process + who weighs in. DISC split: solo/fast (D), \
                     rallies people (I), consensus/no-rush (S), criteria/data (C); \
                     collaboration (E/A)."
                .into(),
            takeaway: "read: consensus buyer · COO + ops".into(),
            engine_on_prompt: EngineStateEvent::new(
                "listening",
                "discovery",
                Some((2, 4)),
                Some("recommended"),
            ),
        },
        PlannedCue {
            id: "d3".into(),
            phase: "discovery",
            trigger: "What's a win? What'd hold them back?".into(),
            example: "If this works, what does good look like — and what'd give you pause?".into(),
            technique: None,
            intent: "Ideal outcome + what makes them hesitant. Bold vs incremental (O), \
                     ambition (D), risk + proof needed (N/C), disruption worry (A/S); \
                     skepticism tips toward NEPQ."
                .into(),
            takeaway: "read: outcome-focused · adoption risk".into(),
            engine_on_prompt: EngineStateEvent::new(
                "listening",
                "discovery",
                Some((3, 4)),
                Some("locked"),
            ),
        },
    ]
}

/// The scripted planner: walks [`discovery_cues`] and returns a **canned** scoring
/// progression so the no-API-key dev run and the browser fixture still "watch it
/// learn". Each scored answer firms the profile a step toward the consensus/S read
/// the cues converge on. The [`LlmPlanner`] replaces this with real haiku scoring.
pub struct ScriptedPlanner {
    queue: VecDeque<PlannedCue>,
    scored: usize,
    live_generated: bool,
}

impl ScriptedPlanner {
    pub fn discovery() -> Self {
        ScriptedPlanner {
            queue: discovery_cues().into_iter().collect(),
            scored: 0,
            live_generated: false,
        }
    }
}

/// Canned profile progression for the scripted (no-LLM) path — three steps firming
/// toward the §6.2 consensus/risk-aware read, mirroring the fixture. Index clamps so
/// the live SPIN cue reuses the final step.
fn canned_profile(step: usize) -> (DiscProfile, OceanProfile, &'static str) {
    let table: [(DiscProfile, OceanProfile, &'static str); 3] = [
        (
            DiscProfile { d: 45, i: 35, s: 50, c: 55, primary_type: "C".into() },
            OceanProfile { o: 50, c: 58, e: 45, a: 55, n: 55 },
            "Early read: pain-driven and urgency-aware — still forming.",
        ),
        (
            DiscProfile { d: 40, i: 35, s: 62, c: 60, primary_type: "S".into() },
            OceanProfile { o: 50, c: 64, e: 45, a: 66, n: 56 },
            "Consensus-driven — COO + ops weigh in; values buy-in over speed.",
        ),
        (
            DiscProfile { d: 40, i: 35, s: 70, c: 65, primary_type: "S".into() },
            OceanProfile { o: 50, c: 68, e: 45, a: 72, n: 58 },
            "Consensus-driven and risk-aware — values proof and a low-pressure pace.",
        ),
    ];
    let i = step.min(table.len() - 1);
    let (disc, ocean, summary) = &table[i];
    (disc.clone(), ocean.clone(), summary)
}

#[async_trait]
impl Planner for ScriptedPlanner {
    async fn next_cue(&mut self) -> Option<PlannedCue> {
        if let Some(c) = self.queue.pop_front() {
            return Some(c);
        }
        // Discovery exhausted → one canned live cue (the technique the canned profile
        // converged on, S → SPIN), then done. No generator on the scripted path.
        if !self.live_generated {
            self.live_generated = true;
            let (disc, ocean, _) = canned_profile(self.scored.saturating_sub(1));
            let m = match_technique(&disc, &ocean, self.scored);
            return Some(fallback_live_cue(m.technique, m.tier));
        }
        None
    }

    async fn score_answer(&mut self, cue: &PlannedCue, _buyer_text: &str) -> ScoreResult {
        let (disc, ocean, summary) = canned_profile(self.scored);
        self.scored += 1;
        // Same rules matcher the live planner uses — the no-LLM path still surfaces
        // a real, firming technique match (Suggested → Recommended → Locked).
        let technique = match_technique(&disc, &ocean, self.scored);
        // The scripted path never classifies a material signal (the classifier is a
        // haiku call) — so it never force-re-plans. The no-API-key dev run + browser
        // fixture keep their exact prior behavior; fixture parity for the signal beat
        // is hand-authored in the fixture itself.
        ScoreResult {
            answer: Some(ScoredAnswer {
                takeaway: cue.takeaway.clone(),
                disc,
                ocean,
                summary: summary.to_string(),
                technique,
            }),
            signal: MaterialSignal::None,
        }
    }
}

/// The [QA] heuristic seller gate (§5.3 "keyword-lite"). Replaces the old
/// content-blind "any seller turn advances": we only flip PROMPT → PROCESSING once
/// the seller has actually voiced a question/substantive turn, not a backchannel
/// ("yeah", "right", "mm-hmm"). Free — no LLM, no extra latency. Refining this to a
/// per-cue intent match is a later increment; the haiku budget is spent on the
/// higher-value buyer-answer score instead.
fn seller_voiced(text: &str) -> bool {
    let t = text.trim();
    if t.ends_with('?') {
        return true;
    }
    // A real discovery question survives as a multi-word final; filler does not.
    t.split_whitespace().count() >= 4
}

/// Per-cue lifecycle position. Idle/no-audio are engine-level (status line), not
/// per-cue, so the loop only tracks PROMPT vs PROCESSING; SUCCESS is a transient
/// emit between cues.
enum Lifecycle {
    Prompt,
    Processing,
}

/// The confirmation beat (§5.2): how long the SUCCESS ✓ lingers before the next
/// PROMPT replaces it. Keeps the ✓ from flashing past unseen on a fast turn.
const SUCCESS_DWELL: Duration = Duration::from_millis(900);

/// The natural-turn-boundary window (§5.2): a buyer answer arrives as several STT
/// finals, so we don't score the first one alone (that anchors the read on the
/// opener and misses the rest — e.g. scoring "I head up rev ops" before "…but I'm
/// hands-on and like to understand things first" lands). Instead we accumulate the
/// turn and score it once the buyer has gone quiet this long.
const TURN_PAUSE: Duration = Duration::from_millis(1200);

/// The lifecycle loop — identical for every [`Planner`]. Surfaces the planner's
/// cues one at a time and advances each on real transcript finals, content-aware:
/// a seller final that clears [`seller_voiced`] moves PROMPT → PROCESSING; the
/// buyer's reply is **accumulated across its finals** and scored once at the natural
/// turn boundary ([`TURN_PAUSE`] of buyer quiet, §5.2) — `None` (not actually an
/// answer) keeps PROCESSING, `Some` moves to SUCCESS (+ `profile_update` /
/// `technique_update`) and advances. Ends when the chain is exhausted or the finals
/// channel closes (call ended / mic-only degrade with no buyer stream).
///
/// `skips` is the manual-skip stall-breaker input (§5.2/§5.4): STT-detected advance
/// is the headline, but it's finicky when STT mishears, so the seller can turn the
/// page itself. A `()` on this channel advances to the next cue's PROMPT **without a
/// buyer score** — there's no answer to score, so no `profile_update` /
/// `technique_update` / SUCCESS, just the next head. It's an *input* into this loop
/// (like start/stop), not an emitted wire event. The skip channel is owned by the
/// `skip_cue` command and closes with the call alongside `finals`.
pub async fn run(
    app: AppHandle,
    mut planner: Box<dyn Planner>,
    mut finals: UnboundedReceiver<Final>,
    mut skips: UnboundedReceiver<()>,
) {
    let Some(mut current) = planner.next_cue().await else {
        return;
    };
    surface(&app, &current);
    planner.prefetch(); // start filling the chain behind the head, off the hot path
    let mut state = Lifecycle::Prompt;
    // The buyer's in-progress turn, accumulated across finals during PROCESSING and
    // scored as one once they pause. The pause timer is reset on each buyer final
    // (so it measures quiet *after the buyer*, ignoring seller backchannel).
    let mut turn = String::new();
    let pause = tokio::time::sleep(TURN_PAUSE);
    tokio::pin!(pause);

    loop {
        let awaiting_turn = matches!(state, Lifecycle::Processing) && !turn.is_empty();
        tokio::select! {
            maybe = finals.recv() => {
                let Some(f) = maybe else { break };
                eprintln!("[planner] final from {}: {}", f.speaker, f.text);
                match (&state, f.speaker) {
                    // The seller voiced a substantive turn → start collecting the
                    // buyer's coming reply.
                    (Lifecycle::Prompt, "seller") if seller_voiced(&f.text) => {
                        emit_cue(&app, &current, "processing", None);
                        state = Lifecycle::Processing;
                        turn.clear();
                    }
                    // A buyer final — append to the turn and (re)arm the boundary
                    // timer. We score the whole turn, not this fragment.
                    (Lifecycle::Processing, "buyer") => {
                        if !turn.is_empty() {
                            turn.push(' ');
                        }
                        turn.push_str(&f.text);
                        pause.as_mut().reset(tokio::time::Instant::now() + TURN_PAUSE);
                    }
                    // Seller backchannel during prompt / seller mid-processing / an
                    // off-turn final: not a transition — keep waiting.
                    _ => {}
                }
            }
            // Manual skip (§5.2/§5.4): the stall-breaker. Advance to the next cue's
            // PROMPT *without* scoring — no `profile_update` / `technique_update` /
            // SUCCESS, because there's no answer to score; just surface the next
            // head. Works from either PROMPT (the seller voiced it but STT missed)
            // or PROCESSING (the buyer answered but the score is stuck), so we clear
            // any half-collected buyer turn. A closed channel (call ended) ends the
            // loop, mirroring the finals arm. `next_cue` honours its usual contract:
            // instant during discovery, awaits an in-flight prefetch during live.
            maybe_skip = skips.recv() => {
                let Some(()) = maybe_skip else { break };
                eprintln!("[planner] manual skip — advancing without a score");
                turn.clear();
                match planner.next_cue().await {
                    Some(next) => {
                        current = next;
                        surface(&app, &current);
                        planner.prefetch();
                        state = Lifecycle::Prompt;
                    }
                    None => break, // chain truly done; stay listening
                }
            }
            // The buyer has gone quiet for TURN_PAUSE → the turn is complete; score
            // the whole accumulated answer.
            _ = &mut pause, if awaiting_turn => {
                eprintln!("[planner] scoring turn: {turn}");
                let ScoreResult { answer, signal } = planner.score_answer(&current, &turn).await;
                turn.clear();
                let answered = answer.is_some();

                // A real answer always gets its SUCCESS beat + profile/technique fill —
                // the read firmed up regardless of whether a re-plan is also firing.
                if let Some(scored) = answer {
                    emit_cue(&app, &current, "success", Some(scored.takeaway));
                    emit(
                        &app,
                        RealtimeEvent::ProfileUpdate(ProfileUpdateEvent {
                            subject: "buyer",
                            disc: scored.disc,
                            ocean: scored.ocean,
                            summary: scored.summary,
                        }),
                    );
                    // The technique match rides the same scored answer — Buyer +
                    // Technique panels fill together (§5.4).
                    emit(
                        &app,
                        RealtimeEvent::TechniqueUpdate(TechniqueUpdateEvent {
                            technique: scored.technique.technique,
                            tier: scored.technique.tier,
                            rationale: scored.technique.rationale,
                        }),
                    );
                    tokio::time::sleep(SUCCESS_DWELL).await;
                }

                // Material signal (§5.3): regenerate the chain from the new state.
                // Live phase always; discovery only once the read is established (the
                // planner applies the profile-completeness guard) — and then it flips
                // to live. `force_replan` clears the queue + force-starts a
                // signal-shaped generation; the queued cues are moved out of the way
                // and the next `next_cue` returns the freshly-planned head.
                let in_discovery = current.phase == "discovery";
                let acted = signal != MaterialSignal::None
                    && planner.force_replan(signal, in_discovery);
                if acted {
                    if let Some(wire) = signal.as_wire() {
                        // The acknowledgment beat — shown while the (un-prefetchable)
                        // re-plan generation runs; cleared when the new head surfaces.
                        emit(
                            &app,
                            RealtimeEvent::MaterialSignal(MaterialSignalEvent { signal: wire }),
                        );
                    }
                } else if !answered {
                    // Not a real answer and nothing to re-plan on → stay PROCESSING,
                    // await the next turn.
                    continue;
                }

                // Take the next cue. After a force_replan the queue was cleared, so
                // this awaits the freshly-planned, signal-shaped head (~one generation
                // round-trip — material signals are unpredictable, so unlike the flip
                // this can't be prefetched). Otherwise `prefetch` has usually made it
                // instant. An exhausted scripted chain returns None and ends the loop.
                match planner.next_cue().await {
                    Some(next) => {
                        current = next;
                        surface(&app, &current);
                        planner.prefetch();
                        state = Lifecycle::Prompt;
                    }
                    None => break, // chain truly done; stay listening
                }
            }
        }
    }
}

/// Emit the cue's pre-prompt engine-state (progress / confidence creep) then the
/// PROMPT itself.
fn surface(app: &AppHandle, cue: &PlannedCue) {
    emit(app, RealtimeEvent::EngineState(cue.engine_on_prompt.clone()));
    emit_cue(app, cue, "prompt", None);
}

fn emit_cue(app: &AppHandle, cue: &PlannedCue, lifecycle: &'static str, takeaway: Option<String>) {
    emit(
        app,
        RealtimeEvent::Cue(CueEvent {
            id: cue.id.clone(),
            phase: cue.phase,
            state: lifecycle,
            trigger: cue.trigger.clone(),
            example: cue.example.clone(),
            technique: cue.technique,
            takeaway,
        }),
    );
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn material_signal_wire_round_trips() {
        for s in ["objection", "buying_signal", "new_stakeholder", "pricing"] {
            let parsed = MaterialSignal::from_wire(s);
            assert_ne!(parsed, MaterialSignal::None, "{s} should parse to a material label");
            assert_eq!(parsed.as_wire(), Some(s), "{s} should round-trip back to its wire string");
            assert!(!parsed.replan_hint().is_empty(), "{s} must carry a re-plan direction");
        }
        // Unknown / "none" → no signal (no re-plan, nothing to surface).
        assert_eq!(MaterialSignal::from_wire("none"), MaterialSignal::None);
        assert_eq!(MaterialSignal::from_wire("garbage"), MaterialSignal::None);
        assert_eq!(MaterialSignal::None.as_wire(), None);
        assert!(MaterialSignal::None.replan_hint().is_empty());
    }

    #[test]
    fn signal_fallback_is_signal_specific_and_live() {
        // Each material signal degrades to a distinct, on-signal canned cue (never the
        // generic technique cue) so a failed re-plan still moves toward what was raised.
        let cases = [
            (MaterialSignal::Objection, "live-objection"),
            (MaterialSignal::BuyingSignal, "live-buying"),
            (MaterialSignal::NewStakeholder, "live-stakeholder"),
            (MaterialSignal::Pricing, "live-pricing"),
        ];
        for (sig, id) in cases {
            let cue = signal_fallback_cue(sig, "spin", "locked");
            assert_eq!(cue.id, id);
            assert_eq!(cue.phase, "live");
            assert!(!cue.example.is_empty() && !cue.intent.is_empty());
        }
        // No signal falls through to the technique fallback.
        assert_eq!(
            signal_fallback_cue(MaterialSignal::None, "spin", "locked").id,
            fallback_live_cue("spin", "locked").id,
        );
    }
}
