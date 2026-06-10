# Realtime engine — latency decisions (§7)

> Companion to [UX_SPEC.md](UX_SPEC.md) §7. Records the model-routing + latency
> choices for the live coaching loop, with the measurements behind them. Updated as
> the planner increments land (M23). Numbers marked _(live: TBD)_ await a real
> spoken+buyer-audio run — static request-shape validation is done, end-to-end
> wall-clock on the live path is Cassandra's to confirm.

## What runs on the latency budget

The live path makes **haiku tool_use round-trips** (no Rust SDK — raw `reqwest`,
structured output forced via a single `tool_use` tool, mirroring `packages/ai`'s
`generateStructured`; we never prompt "respond in JSON"). Two call sites:

| Call | When | Frequency | System prompt | Output |
| --- | --- | --- | --- | --- |
| **Buyer score** (`LlmPlanner::call`) | each buyer answer | once per cue | `SYSTEM` (~250 tok) | DISC/OCEAN + answered? + takeaway |
| **Chain generate** (`LlmPlanner::generate_live`) | chain runs dry — the discovery→live flip, then each live-chain exhaustion | once per ~2–3 live cues | `PLAN_SYSTEM` (~400 tok) | a queue of 2–3 two-tier cues |

The **technique match** is *not* an LLM call — it's the pure-Rust rules matcher
(`planner/technique.rs`) reading the DISC/OCEAN the buyer-score call already
produced. **Zero added latency** for the Technique pill and for picking which
technique's cue set the generator draws from. (Decision recorded in PG-276 A1.)

## Model routing

Coaching = **Anthropic haiku (`claude-haiku-4-5-20251001`) called directly** from
the Rust engine over `reqwest`. No backend hop (one fewer network leg), no Rust
Anthropic SDK (none official). OpenAI is harness-baseline-only and not in this path.

## Measurements

- **Buyer score:** **~2.4 s** round-trip including cold TLS, measured via `curl`
  against the live API with the exact request shape (HTTP 200, correct `tool_use`
  schema, sensible read). A warmed `reqwest` client (connection reused across the
  call's many scores) should sit below this. Per-call timing is logged:
  `[planner/haiku] Nms · scored cue …`.
- **Chain generate:** _(live: TBD)_ — structurally the same single-`tool_use`
  round-trip with a modestly larger output (2–3 cues ≈ a few hundred tokens), so
  expect **comparable, ~1.5–2.5 s** once the client is warm. Logged on each call:
  `[planner/haiku] replan Nms · N live cues · technique/tier`.

## Measured (live, Scenario A)

- Buyer score: **~2.0–2.7 s** warm *and* cold — connection pooling barely moves it, so
  the cost is the round-trip + inference, not TLS. No "warm-up" win to chase.
- **Chain generate: ~5.0–5.2 s** (3 cues) — ~2.5× a score, because output generation
  (not the round-trip) dominates. Two live runs: 5220 ms, 5081 ms.

So a *synchronous* replan at the flip cost ~5 s + the 900 ms SUCCESS dwell ≈ **~6 s of
lingering ✓** at the most important transition. That drove the prefetch fix below.

## Where we pay it (and why it's tolerable)

- **Buyer score** lands *inside* the PROCESSING beat — the perceived "it's thinking
  about what the buyer just said" moment (§5.2). The latency *is* the UX here, not a
  stall.
- **Chain generate** now runs in a **background task** (see prefetch below), so its
  ~5 s lands *off* the hero's critical path — overlapping live conversation instead of
  stalling the flip.
- **Stall-safety:** a generate failure (or empty result) degrades to a canned,
  on-technique `fallback_live_cue` — live coaching never goes dark. A buyer-score
  failure degrades to the cue's canned takeaway + last-known profile. Neither ever
  freezes the cue.

## Implemented — background prefetch

The synchronous `replan()` was replaced with background generation
(`LlmPlanner::start_generation`, behind the `Planner::next_cue` / `prefetch` seam):

- The cue queue is shared (`Arc<Mutex<VecDeque>>`) between the lifecycle loop and a
  spawned generation task. `prefetch()` is called right after each cue is surfaced;
  when it finds the queue **empty behind the surfaced head**, it spawns a generation
  (snapshotting profile + technique + recent answers, so the task borrows nothing).
- That means generation kicks off when the **last discovery cue (d3) is surfaced** and
  runs *during* d3's ~10–15 s Q&A — so the live chain is already queued when discovery
  completes and the flip is **instant**. The same mechanism keeps the live phase topped
  up: each batch's last cue triggers the next batch's generation in the background.
- `next_cue()` awaits an in-flight generation **only** if the queue is genuinely empty
  (generation outran the conversation — rare, since a cue lifecycle ≫ 5 s). A
  `tokio::Notify` wakes it; `notify_one`'s stored-permit semantics avoid a missed
  wake-up, and a `generating` flag (atomic `swap`) prevents double-spawn.
- Cost: generation uses the profile as of the **2nd-to-last** scored answer (it starts
  before the last answer lands). Acceptable — the technique is already locked by then,
  and the next background batch picks up the fresher read.

Net: the ~5 s round-trip is unchanged, but it no longer blocks the hero. Trimming
generation to 2 cues / lower `max_tokens` (~3 s) remains an optional cost/buffer win,
not needed for the felt latency.

## Material-signal re-plan (B1) — the one re-plan we *can't* prefetch

The buyer-side material signal (§5.3) is classified by **one extra field on the
existing buyer-score call** — no second round-trip, so the classifier adds **zero
latency** to the score beat. When the label is material (objection / buying_signal /
new_stakeholder / pricing), the planner clears the live queue and **force-starts a
signal-shaped generation** (`LlmPlanner::force_replan` → `force_replan_inner`).

Unlike the discovery→live flip, a material re-plan **cannot be prefetched** — the
signal is unpredictable, so generation only starts *after* the buyer raises it. So
this generation (~5 s, the same chain-gen cost) lands **on** the critical path: the
next `next_cue()` awaits it. We cover that gap with the **acknowledgment beat** (the
`material_signal` wire event → a brief "caught an objection — re-planning" status
line), so the wait reads as the engine reacting rather than a stall. Stall-safe as
ever: a failed/empty generation degrades to a **signal-appropriate** canned cue
(`signal_fallback_cue`), not a generic technique cue.

Race safety against the background prefetch is handled by a **generation epoch**
(`gen_epoch: AtomicUsize`): `force_replan` bumps it, so any in-flight steady-state
generation discards its result on completion (stale epoch) instead of polluting the
fresh signal-shaped chain — no double-extend, no lost `Notify` wake-up.

**Optimization available (deferred):** because this round-trip *is* on the hero's
path, trimming the material-re-plan generation to **2 cues / lower `max_tokens`**
(~3 s) is more valuable here than for the background flip — it directly shortens the
felt gap. Left for a tuning pass; the beat makes the current ~5 s acceptable.

## Caveat — prompt caching is a no-op at this prompt size

Both system prompts are sent with `cache_control: ephemeral`, but **haiku's prompt
cache has a 1024-token minimum** for a cache *write*. `SYSTEM` (~250 tok) and
`PLAN_SYSTEM` (~400 tok) are both below it, so `cache_creation_input_tokens: 0` —
the directive is inert today. It only starts paying off once a system prompt grows
past ~1024 tokens (e.g. if the technique repertoire or scoring rubric is expanded
inline). **Do not pad the prompt to reach the floor** — caching saves input-token
cost, not the round-trip latency that actually bounds this UX, so padding would cost
tokens for no latency benefit. Revisit only if a prompt naturally crosses 1024.
