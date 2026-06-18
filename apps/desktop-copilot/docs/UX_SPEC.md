# Pitch Genius Co-pilot — Desktop UX Spec

> **Status:** Draft, in active co-authoring (started 2026-06-08). Filled section by
> section as we walk the UX. Sections marked _TO FILL_ are pending screenshots +
> walkthrough. Sections marked **[FLAG]** are open product questions — don't build
> past them without confirming.

## 0. Meta & locked decisions

This spec defines the **desktop Co-pilot** plus a **minimal companion web app**. The
Co-pilot starts at true cold-start — no account, no data — and walks a new user all
the way to their first live-coached call; the web app is where account creation, data
ownership, and saved-call review live.

**The MVP ships two apps, both mocked, no backend.** The minimal web app (account/auth,
saved-call vault + review) runs on **seeded mock data with no backend** (real auth + server storage are still
deferred, §10). The **desktop app launches the web app**, and the two run together. See
§11 for the web app's scope.

**Stack:** Tauri 2 + React 19 + Rust (`apps/desktop-copilot`). Builds on the existing
NSPanel always-on-top overlay (PG-244 / M21).

**Decisions locked this session:**

| Decision                           | Choice                                               | Implication                                                                                                                                                              |
| ---------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Real-time transcription + coaching | **Live audio + STT** (real pipeline)                 | Real capture → STT → coaching loop; latency budget is the core UX risk (see §7)                                                                                          |
| Lifecycle scope                    | **In-call overlay** + (new) **first-run onboarding** | Product/ICP context captured at onboarding (§4.3, re-scoped IN 2026-06-10); no per-lead pre-call enrichment screen (a removable **call-script plan** preview is added, §5.8); a duration-aware call script backs the planner (§5.8); end-of-call is a **basic summary only** (§5.7) — full post-call analysis is out of v1                                                       |
| Deal/profile data source           | **Reuse `@pg/shared` + mock store**                  | Speech is live; supporting context is seeded/derived (see §6)                                                                                                            |
| Positioning                        | **Copilot + minimal companion web app**              | Both ship in the MVP; web app is mocked (seeded, no backend); the full web app stays deferred (§10)                                                                      |
| Account + call persistence         | **Minimal web app** (mocked: seeded, no backend)     | Account/auth + saved-call vault & review live in the web app; desktop app launches it; real auth/storage deferred to §10 (§11)                                           |
| Profiling scope                    | **Buyer only**                                       | The **buyer** is profiled live (from call audio), and the SPIN/Challenger/NEPQ technique is matched to the buyer. The seller is not profiled. |
| Visual look & feel                 | **Glass-derived design language**                    | Smoked-glass translucency, pill chrome, near-monochrome + one accent, system-sans UI; codified in §12. Glass replaces Cluely as the **visual** reference (Cluely stays the onboarding-flow feel ref)                                              |

## 1. Product framing

The Co-pilot fuses **real-time reaction** (live transcript + coaching cues off real call
audio) with **layered intelligence about the buyer**. In the
cold-start case this intelligence is **built up, not pre-loaded** — nothing about the lead
is collected before the call:

- Technique selection (SPIN / Challenger / NEPQ) keys off the **buyer** and happens live
  (sibling doc + §6.2). The seller is not profiled.
- The **product / ICP / problem context** (the seller's product line, each product's ICP and
  the problem it solves) is captured at **onboarding** (§4.3) — prefilled from the seller's
  website (mocked scrape), editable, stored in the shared mock store. It's the thing that
  exists _before_ the call, and it **grounds the generated call script** (§5.3/§6.2). The
  seller does **not** pick which product the call is about up front; the relevant product is
  **inferred and confirmed live** as the buyer reveals their situation (§4.3/§5.3).
- The **buyer profile** (DISC/OCEAN, `LeadPsychProfile`) and the **pipeline stage** are
  assessed **live, from the call transcript** — the app prompts the seller to ask the buyer
  discovery questions, and the buyer's spoken answers are scored as the
  conversation unfolds.

(On a **return call** with a lead already in our system, the buyer profile + stage _can_ be
pre-loaded. But v1 is the **cold-start UX**: no lead context, everything derived.)

The logic that grounds the coaching is being spec'd piece by piece:

- **Technique definitions + profile → technique matching** — defined in
  [docs/sales-technique-matching.md](docs/sales-technique-matching.md): SPIN / Challenger /
  NEPQ in build-against terms, plus DISC/OCEAN base leanings the matching engine starts
  from (it then weighs confidence and adjusts mid-call: Suggested / Recommended / Locked).
- **Still TBD** — the DISC/OCEAN **scoring rules** (buyer; seller scoring is cut) and the live
  **pipeline-stage assessment**. Treat these as placeholders; don't invent the rules.

**The unique value of Pitch Genius:** coaching that is **not generic** — it is specific to
**this buyer**, delivered through a sales technique matched to **how this buyer buys**
(per [docs/sales-technique-matching.md](docs/sales-technique-matching.md)).

## 2. Golden-path narrative (the demo spine)

The exact 2–3 minute sequence the whole app is optimized to nail. Codegen builds this
path first; everything else hangs off it.

_TO FILL: beat-by-beat walkthrough._

## 3. User journey overview

**Entry scenarios, by priority (re-prioritized 2026-06-17):**

1. **Set-up, signed-in user — no onboarding (the demo spine).** The account already has
   product context (a real account → **hydrated** from it via `workspace.getCurrent`; the
   demo → seeded) and opportunities. Open → pick a deal (or be launched into one) → live
   overlay. No welcome, no permissions re-prompt, no product capture. **This is the most
   important path; the demo runs on it.**
2. **Desktop-first onboarding — a new customer who starts on the desktop.** Sign up / sign in
   and capture product / ICP context _on the desktop_ (§4.3), then into the overlay. **This is
   the real first-run path to build** — auth approach is an open decision (see PG-315). Needed,
   but not necessarily the next thing.
3. **(Edge) Web-onboarded, then routed through desktop onboarding.** Shouldn't occur — a
   web-onboarded account already has context, so the desktop **hydrates** (scenario 1) and
   skips capture. Kept only as a defensive fallback; **not a path we design around.**

The cold-start arc (scenario 2):

```
First run (no account / no data)
  → Welcome
  → Permissions (mic, system audio / screen capture, overlay/accessibility)
  → Product / ICP context (seller's website → scrape prefill → edit) — all products captured; none chosen for the call yet
  → Call setup
  → LIVE in-call overlay coaching
       → app prompts seller to ask the buyer discovery questions
       → buyer's live answers  ──► buyer DISC/OCEAN profile (LeadPsychProfile)
       → technique matched to the buyer live (SPIN / Challenger / NEPQ)
       → relevant product inferred + confirmed live (matched to the buyer's revealed problem)
       → pipeline stage assessed live from the conversation
```

- **Buyer(s)** are profiled **live** during the call, from their speech (`LeadPsychProfile`).
- This makes **speaker separation (seller vs. buyer) a first-class requirement**: every
  utterance must be attributed correctly or both profiling and cue attribution break.
  See [docs/audio-capture-and-speaker-separation.md](docs/audio-capture-and-speaker-separation.md).

## 4. First-run onboarding _(starting here — walking step by step)_

### 4.1 Cold start / welcome

> **Re-prioritization note (2026-06-17):** desktop-first onboarding (journey §3, scenario 2)
> is now a first-class path, which puts the "the desktop never collects credentials, the web
> app owns auth" stance below under **active reconsideration — see PG-315**. The web→desktop
> handoff described here stays valid for the web-first user; the open decision is whether the
> desktop also offers a native **"create account"** path, and if so via browser-delegated auth
> (preferred — preserves the no-credentials-in-desktop posture) vs. in-app credential fields.
> The web-onboarded→desktop-onboarding sequence is an **edge case** (§3, scenario 3), not a
> designed path. Resolve PG-315 before treating this section's mechanism as locked.

The Co-pilot opens at true cold-start: no account, no data, no permissions granted. Two
things happen before onboarding proper (§4.3): a one-line **welcome** that frames what's
about to happen, and **account sign-in** — which, per §0/§11, is owned by the **companion
web app**, not the desktop app. The desktop app never collects credentials; it hands off to
the web app and receives a session back via deeplink.

> **Reference** (Cluely — UX-feel only, §9; full set + map in
> [`reference/cluely-onboarding/`](reference/cluely-onboarding/README.md)):
> [sign-in](reference/cluely-onboarding/01-signin-continue.png) ·
> [OAuth consent](reference/cluely-onboarding/02-signin-oauth-consent.png) ·
> [redirect loading](reference/cluely-onboarding/03-signin-loading.png) ·
> [deeplink handoff](reference/cluely-onboarding/04-signin-deeplink-open-app.png)

**Sequence (adapted from Cluely's web → desktop handoff):**

1. **Welcome (desktop).** Brand mark, one-line value prop ("Real-time coaching for live
   sales calls"), a single primary CTA (**Sign in / Get started**). Minimal, translucent,
   draggable shell — reuses the NSPanel overlay chrome (PG-244).
2. **Hand off to the web app for auth.** The CTA opens the companion web app's sign-in
   route. The desktop app does **not** render the auth form. **Launch mechanism — resolved
   (2026-06-08): embedded webview window in the same Tauri app**, so desktop + web share local
   state (see §11). Because it's one process sharing state, the web→desktop **deeplink/token
   handoff collapses to a shared-store session flip** — the deeplink narrative below is kept as
   the it-feels-real option but is **not required** for the mock.
3. **Web sign-in.** An email field ("Continue to Pitch Genius"). Auth is **mocked** — it
   authenticates against nothing (§11), so any input succeeds. **Providers — resolved
   (2026-06-08): email-only** across all flows; no OAuth provider buttons, no OAuth round trip.
   (Step 4's OAuth consent is therefore skipped.)
4. **OAuth consent (only if a real provider is shown).** Standard "Sign in to Pitch Genius"
   consent + a brief loading state on redirect back to the web app.
5. **Deeplink back to the desktop app.** The web app deep-links into the Co-pilot with a
   token (`pg-copilot://…?key=…`), the OS shows its "Open Pitch Genius?" confirmation, and
   the desktop app receives the **(mock) session token** and is now signed in. The web page
   shows an "Opening Pitch Genius… / if the app didn't open, click here" fallback plus a
   "Don't have it yet? Download" affordance, and reflects the signed-in identity + Sign Out.

**Deltas from Cluely (clean-room — Cluely is UX-feel reference only, §9):**

- Auth is **mocked**, not a real IdP. The deeplink `key` is a mock session handle, not a
  verified credential — it exists to make the web→desktop handoff feel real for the demo.
- The handoff direction (web → desktop, carrying a token) is the **inverse** of §11's
  open question about desktop → web _call_ handoff; both ride the same deeplink/launch
  decision, so resolve them together.

| Cluely screen                             | PG equivalent                                                         |
| ----------------------------------------- | --------------------------------------------------------------------- |
| "Continue to Cluely" (Apple/Google/email) | "Continue to Pitch Genius" — email-only by default (§4.1.3 FLAG)      |
| Google OAuth consent                      | Only if a real provider is surfaced; else skipped                     |
| `desktop-sign-in/deeplink-with-token`     | `pg-copilot://…?key=<mock-token>` deeplink + "Opening…" fallback page |

### 4.2 Permissions — mic, system audio, overlay/accessibility

A single **"Let's get you set up"** screen. **Left column:** three permission cards, each
with an icon, a label, a one-line rationale, and a live toggle. **Right column:** a
contextual helper panel that mirrors the relevant macOS System Settings pane while a
permission is pending, and flips to an **"All set!"** confirmation once all three are
granted. A **Continue** CTA advances to §4.3.

> **Reference** (Cluely — UX-feel only, §9; full set + map in
> [`reference/cluely-onboarding/`](reference/cluely-onboarding/README.md)):
> accessibility [prompt](reference/cluely-onboarding/05-perm-accessibility.png) ·
> [→ settings](reference/cluely-onboarding/06-perm-accessibility-settings.png) ·
> microphone [prompt](reference/cluely-onboarding/07-perm-microphone.png) ·
> [OS prompt](reference/cluely-onboarding/08-perm-microphone-prompt.png) ·
> screen-recording [prompt](reference/cluely-onboarding/09-perm-screen.png) ·
> [→ settings](reference/cluely-onboarding/10-perm-screen-settings.png) ·
> [settings pane + quit-&-reopen](reference/cluely-onboarding/11-perm-screen-settings-pane.png) ·
> [all set](reference/cluely-onboarding/12-perm-all-set.png)

Unlike a generic assistant, PG's three permissions map directly to the **real-time engine
(§7)** — and two of them are the two halves of **speaker separation**: **seller = mic
input, buyer = system/output audio**. Frame the card copy around _that_, not around
"assist / answer questions about your screen."

| Card (PG copy)                  | macOS TCC permission            | PG capability it unlocks                                                                                   | Speaker-sep role |
| ------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------- |
| **Hear your voice**             | Microphone                      | Capture the **seller's** speech for live transcription + coaching                                          | seller stream    |
| **Hear the call & stay hidden** | Screen & System Audio Recording | Capture the **buyer's** audio (system/output tap) **and** keep the overlay out of the buyer's screen-share | buyer stream     |
| **Assist (overlay)**            | Accessibility                   | Global hotkeys (show/hide, ask) + always-on-top NSPanel app-aware behavior                                 | —                |

**Why "system audio" lives under Screen Recording on macOS.** On Sequoia, capturing other
apps' audio (Zoom/Meet output = the buyer) rides the **"Screen & System Audio Recording"**
TCC bucket — whether the capture path is ScreenCaptureKit or Core Audio process taps
(`cidre`, §8). The same permission is what lets us mark the overlay as excluded from the
buyer's screen-share. So one card buys two PG capabilities (buyer audio + overlay
invisibility). **[FLAG]** the exact entitlement depends on the chosen capture path (§8) —
confirm when the audio subsystem lands.

**Per-permission grant flow** (toggle → native prompt → settings → return):

- **Microphone** is the only one macOS can grant **inline** — flipping the toggle fires the
  standard "would like to access the Microphone" prompt with Allow/Don't Allow.
- **Accessibility** and **Screen & System Audio Recording** have **no inline grant** — macOS
  only offers "Open System Settings." The card's button becomes _"Open accessibility
  settings" / "Open screen settings,"_ deep-links to the exact pane, and the helper panel
  shows where to flip the app's switch.
- **Screen recording additionally requires quit & reopen** to take effect (the macOS
  "…may not be able to record… until it is quit / Quit & Reopen" dialog). Handle the
  relaunch gracefully and resume onboarding where it left off.
- The app must **re-check permission state on launch/focus** — any of these can be revoked
  in System Settings at any time, and a revoked mic/system-audio silently breaks the call.

**Gating & recovery:**

- **Gating — resolved (2026-06-08):** **hard-gate Continue on mic + system-audio** (no
  buyer/seller capture ⇒ the core demo is dead); **Accessibility is soft** — the overlay still
  floats via NSPanel without it (it only buys global hotkeys), so Continue is allowed with a
  "you can enable this later" note. Live audio is **mandatory** for the demo, so the two audio
  permissions are non-negotiable gates.
- Each card needs an explicit **denied** state with a "re-open settings" affordance, since
  the only recovery path for accessibility/screen recording is System Settings.

**Single-prompt hygiene.** The double `"Cluely" / "Cluely (New)"` prompts in the reference
screenshots are an artifact of two installed builds — ship **one signed app identity** so
the user sees exactly one OS prompt per permission.

### 4.3 Product / ICP context (seller's website → scrape → product info) — _re-scoped IN for v1 (2026-06-10)_

> **Reverses the 2026-06-08 deferral.** This section previously cut product context. It is now
> **in v1**: the generated call script (§5.3/§6.2) is grounded in the seller's products, each
> product's ICP, and the problem it solves. Without it, cues stay generic; with it, they're
> product- and buyer-specific — the whole point of "coaching that isn't generic" (§1).

The first onboarding step after permissions captures the seller's **product /
ICP / problem context**. The hero interaction is **paste your website link → we prefill**.

**Flow:**

1. **Paste a URL.** One field: _"Paste your website and we'll learn what you sell."_ A single
   primary CTA kicks off the scrape.
2. **Scrape → prefill (mocked).** A brief "reading your site…" beat, then the form prefills. The
   scrape is **mocked** for v1 (canned extraction), consistent with every other AI/auth surface
   in this build — a real website-scrape chain is a backend follow-up (§6/§10).
3. **Review + edit.** Every prefilled field is fully **editable**; the seller corrects/adds and
   can add **more than one product** (see _Multi-product_ below). Manual entry (no URL) is always
   available as a fallback.
4. **Save → continue** to call setup (§4.4).

**What we capture — per product:**

| Field           | What it is                                  | Used for                                                |
| --------------- | ------------------------------------------- | ------------------------------------------------------- |
| **Name**        | Product name                                | Labeling; the live product match (§5.3)                 |
| **Description** | What it is / does, in a sentence or two     | Grounding the generated cues                            |
| **ICP**         | Who it's for (ideal customer profile)       | Reading buyer-fit live; tailoring discovery             |
| **Problem**     | The problem it solves                       | Matching the buyer's revealed pain → the right product  |

**Multi-product, no up-front pick (resolved 2026-06-10).** A seller may carry **several
products**, and **which product a given call is about is often unknown until the call**. So
onboarding captures **all** products as context and the seller does **not** choose one before
starting. The relevant product is **inferred live** — as the buyer reveals their situation, the
planner matches it against each product's `problem`/`icp` and surfaces a **likely product** for
the seller to confirm (§5.3). A `primary` product **emerges over time** (mirroring
`@pg/shared`'s `isPrimary`); at the start none is primary. Onboarding stays "tell us what you
sell," not "pick today's product."

**Storage.** Lives in the **shared mock store** (Zustand) that the desktop app and the embedded
companion web app already share (§11) — editable in-app from either half. This is the **eventual
DB swap path**: it maps onto `@pg/shared`'s 1:N products-per-workspace model, so moving it
server-side later is a data-layer change, not a re-spec. (Shape: §6.3 `SellerProductContext`.)

**Gating — _proposed, confirm._** Onboarding **completes once at least one product's context
exists** (the script depends on it), prefilled-then-editable so it stays light. The **call
itself does not gate on choosing a product** — that's resolved live (§5.3). _(You answered
"Other" on the gating question; this is my read of "the app needs to make sure it has this info"
+ "which product is unknown until the call." Tell me if you'd rather it be fully skippable with a
generic-cue fallback.)_

### 4.4 Transition into first call (buyer profiled live) — _partial; call setup added 2026-06-10_

Most of this is still _TO FILL_, but one piece is now specified: **call setup captures the
scheduled call duration**, which budgets the call-script skeleton (§5.8). v1 ships a **manual
field, default 30 min** (calendar integration stays out of scope). The duration is set before
Start call and is editable; it allocates the per-segment time boxes the planner paces against.
The seller does **not** pick a product here — product is matched live (§4.3/§5.3).

_TO FILL: the rest of call setup + the hand-in to the first live prompt._

## 5. In-call overlay

The in-call overlay is the product's center of gravity. Its design law: **the live
coaching prompt is the hero, shown one at a time, and everything else stays collapsed
until asked for.** We borrow Cluely's translucent-minimal feel and its habit of _teaching
the user how to drive it_ (§5.6), but we **drop Cluely's open "ask anything" field** — PG's
prompts are **pushed** to the seller, not pulled (§5.4).

**Locked this session (2026-06-08):**

| Decision           | Choice                                                                                                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hero element       | A single coaching **prompt**, shown one at a time                                                                                                         |
| Prompt advance     | **STT-detected** — the engine hears the seller voice the prompt's intent; no manual tap needed (manual skip is a stall-breaker only, §5.2)               |
| Prompt lifecycle   | `PROMPT → PROCESSING → SUCCESS → next` (§5.2)                                                                                                              |
| Prompt stream      | **Discovery-first, then dynamic** — the finite §6.2 discovery script builds the buyer profile, then the overlay shifts to a live dynamic cue stream (§5.3) |
| No ask field       | Prompts are pushed, not pulled — no free-text input on the overlay (delta from Cluely, §5.4)                                                              |
| Persistent rail    | Start/End call · Detectable toggle · reveal pills: Transcript / Seller / Buyer / Technique                                                                |
| End-of-call        | A **basic in-overlay summary** with a deeplink into the web app + a **resume** affordance (§5.7) — full post-call analysis is out of v1                    |

### 5.1 Overlay anatomy

A single translucent NSPanel bar (PG-244 chrome), always-on-top and draggable, styled per the
**Glass-derived design language (§12)** — a smoked-glass capsule. Three zones:

- **Control rail (persistent, compact)** — the always-visible chrome:
  - **Start call / End call** — the lifecycle toggle. Pre-call it reads **Start call**; live
    it becomes **End call** + a running timer.
  - **Detectable toggle** — screen-share visibility (§5.4).
  - **Reveal pills** — _Transcript · Buyer · Technique_ (+ a flagged **Script** pill, §5.8) — collapsed by default;
    each opens its panel (§5.4). A pill carries a subtle dot when its data updates (e.g. the
    **Buyer** pill pulses when a discovery answer sharpens the profile).
- **Hero (the prompt)** — when live, the dominant element. Each cue renders in **two tiers**:
  the **short trigger** large and prominent — the glanceable thing (_"What's it costing?"_) —
  and **beneath it, smaller, a full-sentence example** the seller can fall back on (_"If that
  doesn't change, what does it cost you over the next year?"_). The seller rephrases in their
  own voice; the example is a prompt, **not** a script to read verbatim. Shown in its lifecycle
  state (§5.2); empty pre-call. _(This two-tier format supersedes the earlier "full sentences
  never appear on screen" stance — see §6.2.)_
- **Status line** — a thin line for engine state (listening / no-audio / processing), the
  phase indicator (`Discovery 2/3` → `Live`), **pacing against the duration budget** (current
  segment + time remaining, §5.8), and confidence creep (Suggested → Recommended → Locked, §6.2).

Pre-call the bar is minimal (Start call + the reveal pills showing seeded context). Live, the
hero dominates and the rail recedes.

### 5.2 The prompt lifecycle (states)

The core loop. Each prompt is a small state machine; the overlay renders **exactly one
prompt's state at a time**.

| State            | Seller sees                                            | What's happening                                            | Exit                                                  |
| ---------------- | ----------------------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------- |
| **Idle / pre-call** | Minimal bar, no hero                               | Awaiting Start call                                         | Start call → first PROMPT                              |
| **PROMPT**       | Hero shows the glanceable cue (_"Why now?"_)           | Engine listening for the seller to voice this intent        | STT match → PROCESSING · or manual skip (fallback)    |
| **PROCESSING**   | Cue dims, subtle working indicator                    | Engine scoring the buyer's spoken answer → profile/stage    | Score returns → SUCCESS                                |
| **SUCCESS**      | Brief ✓ + one-glance takeaway (_"read: consensus buyer"_) | Confirmation beat; the relevant pill pulses              | Auto-advance → next PROMPT (or → Live phase if script done) |
| **No-audio**     | Hero replaced by a "can't hear the call" banner       | Mic or system-audio dropped (§4.2 revoke / device change)   | Audio restored → resume where it left off             |

Notes:

- **STT-detected advance is the headline** (locked §5). The seller never taps to move on —
  they run the conversation in their own words and the overlay keeps pace. **Manual skip**
  exists only to break a stall if STT misses; it advances **without** a buyer score.
- **PROCESSING is short by design** — it's the perceived "it's thinking about what the buyer
  just said" beat (latency budget §7). If scoring outruns the buyer, SUCCESS waits for a
  natural turn boundary so the ✓ never fires mid-buyer-sentence.
- **No-audio must be loud and recoverable** — a silently-broken mic kills the demo
  (re-check on focus, §4.2).

### 5.3 The planner loop (one loop, two modes)

Both phases run the **same §5.2 task loop** over a **chain** — a queue of "next-best tasks."
The only difference is where the chain comes from. This is the unifying model: Phase 1 is just
"the chain is a fixed script that never re-plans."

- **Phase 1 — Discovery (fixed script).** The chain is the finite §6.2 three-cue script and it
  never re-plans. Advance is STT-detected: the cue appears → STT confirms the seller voiced it
  → the buyer's answer is scored → pop the next cue. This builds the `LeadPsychProfile` +
  pipeline stage from zero. **Resolves the §6.2 flag: discovery cues are a scripted,
  sequential, advance-on-detection chain.**
- **Phase 2 — Live (generated chain).** Once the buyer profile is established, the chain is
  **generated**, not scripted — a running queue of next-best tasks. Identical loop, identical
  `PROMPT → PROCESSING → SUCCESS` visuals; the seller can't tell the chain went dynamic because
  the hero only ever shows its **head** (§5.1).

**The planner.** A model call builds and rebuilds the Phase-2 chain from: **buyer profile +
matched technique (and its confidence tier) + pipeline stage + recent conversation + the
seller's product / ICP / problem context (§4.3, incl. the live-matched active product).** It runs
on a **latency budget (§7)** — re-planning is an LLM round-trip, so _when_ we pay it is a real
constraint. The chain is the **just-in-time expansion of the current segment** of the call-script
skeleton (§5.8): the skeleton is the coarse backbone, the chain is its live wording.

**Two ways the chain advances:**

1. **Complete → pop.** A task reaches SUCCESS → the next task in the chain surfaces. The normal
   beat.
2. **Material signal → re-plan.** _Any_ material signal from the conversation **regenerates the
   chain** from the new state — objection, pricing pushback, a new stakeholder named, the buyer
   cooling, **or** a buying signal. Not trouble-only: any material change re-plans.

**In-flight task on re-plan (for now):** when a re-plan fires while a task is on screen, the
current task is **moved out of the way** and the freshly-planned head takes the hero. Whether a
displaced task re-enters a later plan is the planner's call — we don't special-case it.

**Why the churn is safe:** the hero shows only the chain's **head** (§5.1), so all re-planning
happens off-screen. The seller never watches the plan reshuffle — the current best task just
quietly updates.

**Product grounding + live product match (new, 2026-06-10).** Both phases are now grounded in
the seller's **product / ICP / problem context** (§4.3). Because the active product is **not
chosen up front**, an extra job rides Phase 1: as the buyer's situation accumulates, the planner
matches it against each product's `problem`/`icp` and surfaces a **likely product** the seller
can confirm (a one-tap chip on the **Buyer**/**Technique** pill, or silent if confidence is
high). Once the active product is set, every Phase-2 cue is grounded in **that** product — its
problem framing, its ICP language — on top of the matched technique. Until it's set, cues bias to
product-neutral discovery. Like technique matching, the product match carries soft confidence
(Suggested → Confirmed) and can change mid-call if the conversation turns.

**Discovery checklist / call-script ledger — answered vs. open (new, 2026-06-10; lightweight).** The planner reads a
small **checklist of discovery objectives** so it never re-asks what's been answered and always
knows what's still open. v1 keeps this **lightweight — in-call state only, no per-question DB, no
cross-call persistence:**

- The checklist is a fixed, small list: the **≤3 §6.2 icebreakers** (profile the buyer + match
  technique) plus a few **sales-process milestones** for the matched technique — e.g. _problem
  named · cost/impact established · decision process + stakeholders · success criteria · product
  fit confirmed._
- Each item is `open` / `satisfied`, flipped from the live transcript: the same SUCCESS beat that
  pops a cue (§5.2) marks its objective satisfied. The **Buyer** pill can show a quiet
  "3 / 6 covered."
- **Per-prompt disposition + answer digest (the ledger).** Beyond objective state, each generated
  prompt records its **disposition** — `asked & answered` / `skipped` / `superseded by re-plan` —
  and a **one-line answer digest** _reused from the SUCCESS takeaway the scorer already produces_
  (§5.2). So the ledger costs almost nothing extra — it's that takeaway, persisted. This is what
  (a) stops dupes (never re-ask a satisfied objective), (b) feeds the script panel's "what we
  covered + the gist of each answer" view (§5.8), and (c) doubles as the planner's **compact
  rolling memory** — the JIT loop reads the ledger instead of replaying the whole transcript,
  which is what keeps context bounded on a long call (§5.8/§7).
- The planner's job each re-plan: **pick the next-best open objective** given buyer profile +
  technique + active product, and skip satisfied ones. This *is* the Phase-2 "next-best task"
  queue — the checklist is just its coverage view.
- **Out of scope for v1 (the heavier path flagged in this session):** a persisted, reusable
  per-question bank surfaced in the web app. Noted as a post-MVP upgrade, not built.

**Starter specs — all `[QA]` (mock starting points; need QA + review before build).**

**Material-signal catalog.** Small by design: **2 seller-side signals** (free — reuse the
existing VAD) + **4 buyer-side labels** (one classifier pass, not four detectors).

| Signal                                   | Stream      | Detection                  | Re-plans toward                |
| ---------------------------------------- | ----------- | -------------------------- | ------------------------------ |
| Seller monologuing (>~30s, no question)  | seller mic  | **free** — talk-time / VAD | "ask, don't pitch"             |
| Seller stuck / long silence              | seller mic  | **free** — VAD gap         | surface next chain head        |
| Buyer objection / resistance             | buyer audio | classifier label           | reframe / handle               |
| Buying signal ("how soon", "what price") | buyer audio | classifier label           | trial close / advance          |
| New stakeholder / decision-maker named   | buyer audio | classifier label           | decision process / multi-thread |
| Budget / pricing raised                  | buyer audio | classifier label           | value / commercial             |

The four buyer-side rows are **one classifier emitting one of four labels**. The demo can run
this keyword-lite over the canned recording.

**Per-technique cues.** The planner pulls from the **matched technique's** set; each renders
two-tier (§5.1) — prominent trigger + secondary example; the seller rephrases in their own
voice. If the technique is only **Suggested**, bias toward neutral discovery cues until it
firms to **Recommended**.

| Technique      | Trigger (prominent)        | Example (secondary)                                                  |
| -------------- | -------------------------- | ------------------------------------------------------------------- |
| **SPIN**       | Name the problem           | "What's the biggest friction in how you handle this today?"         |
| **SPIN**       | What's it costing?         | "If that doesn't change, what does it cost you over the next year?" |
| **SPIN**       | Picture it solved          | "If this were solved, what would that free your team up to do?"     |
| **Challenger** | Reframe it                 | "Most teams think the issue is X — the real driver is usually Y."   |
| **Challenger** | Risk of doing nothing      | "The bigger risk might be standing still while competitors move."   |
| **Challenger** | Take the wheel             | "Here's what I'd recommend we do next, and why."                    |
| **NEPQ**       | Soften it                  | "It's fine either way — I'm just trying to understand your situation." |
| **NEPQ**       | Let them name the problem  | "What made you start looking at this in the first place?"           |
| **NEPQ**       | Let them conclude          | "So where does that leave you on what needs to happen?"             |

**Cadence / suppression.**

| Rule                                       | Value                                                              |
| ------------------------------------------ | ----------------------------------------------------------------- |
| Never surface mid-seller-speech            | gate on mic VAD; surface only at a turn boundary (**free**)       |
| Steady-state floor                         | ≤ ~2–3 tasks/min, ~15–20s minimum gap                             |
| Material-signal re-plans **bypass** the floor | surface at the next turn boundary immediately                  |

All numbers are starter values, tunable. The one rule that matters most — **don't talk over
the seller** — is free because it reuses the same VAD driving the rest of the pipeline.

### 5.4 Controls & interactions

**Start / End call.** Start begins capture + the §5.2 loop. End is **always** available (the
seller can bail any time) → §5.7 summary.

**Detectable toggle.** Governs the overlay's **screen-share visibility** — the §4.2
"stay hidden" capability. Default **hidden** (undetectable): if the seller shares their screen,
the coaching overlay does not appear in the buyer's view. Flipping to _Detectable_ makes it a
normal shareable window. Copy should frame this as **screen-share invisibility** — not
concealment that coaching is in use, and unrelated to call recording/consent.

**The reveal pills** (three always-on + a flagged fourth, _Script_, §5.8)**.** Each opens a panel over/beside the bar; all collapsed by default to
protect the hero. **Mutually exclusive** (opening one closes the others) to keep the surface
calm:

| Pill           | Panel content                                                  | Source                          |
| -------------- | ------------------------------------------------------------- | ------------------------------- |
| **Transcript** | Live labeled transcript (seller/buyer separated, §7)          | live STT                        |
| **Buyer**      | Buyer DISC/OCEAN building live + readiness / stage            | live `LeadPsychProfile`         |
| **Technique**  | Matched technique + confidence tier (Suggested/Recommended/Locked) | sales-technique-matching.md |
| **Script** _(flagged)_ | The call-script arc (§5.8): segments done/open + each asked prompt & its answer digest. **Removable** — likely off for the client's clean-cockpit default. | skeleton + ledger (§5.3/§5.8) |

**No ask field (delta from Cluely).** Cluely's hero is a pull-based "ask anything" box. PG
inverts it: the system **pushes** the right prompt at the right time; there is no free-text
input on the overlay. (Open exploration / Q&A lives in the web app, §11.)

**Hotkeys.** Show/hide overlay · toggle detectable · manual-skip prompt · open/close last
panel. _TO FILL: the map (§8 owns binding)._

### 5.5 Seeded context

Pre-call and inside the reveal panels, supporting context (the seller's
product / ICP / problem context per §4.3, any seeded company info) comes from `@pg/shared` + the
mock store (§6). The **Buyer** panel starts **empty** and fills live — that emptiness-then-fill
is part of the demo's "watch it learn" payoff. Per the 2026-06-10 re-scope the overlay **is** now
grounded in product context (§4.3/§5.3): the **Technique** (or **Buyer**) pill can surface the
**live-matched active product** for one-tap confirmation.

### 5.6 Teaching the user (in-call coachmarks)

Borrowed from Cluely: the first live call runs a lightweight **teaching layer** so the seller
isn't lost. On first Start call, ≤4 dismissible coachmarks point out (a) the hero is where
prompts appear, (b) you **don't tap** — just ask the buyer naturally and it advances, (c) the
reveal pills, (d) the detectable toggle. Shown once, re-openable via a `?` affordance. It must
not bury the first real prompt.

### 5.7 End call → basic summary → resume

Ending a call (at any time) drops the overlay into a **basic summary card**. v1 ships a
**basic summary only** — the full post-call analysis is out of scope for now.

- **At-a-glance:** duration · # discovery cues completed · buyer DISC/OCEAN one-liner ·
  matched technique + final confidence tier · pipeline-stage read.
- **Primary CTA — "Open in Pitch Genius":** deeplinks into the **web app** (§11) where the
  full transcript + saved call live. Same launch/deeplink mechanism as the §4.1 auth handoff.
- **Resume call.** The summary belongs to a **call record**, and resume re-enters _that_
  record — the same buyer profile, phase, transcript, and clock continue. So **End is a
  pause-with-summary, not necessarily terminal.** Resume only exists in the context of a call
  record; beginning a fresh conversation is a different action (a new call), not a resume.

**[FLAG · post-MVP]** Multiple calls, same buyer. Because resume continues a single record, we
still need a way to represent **separate calls that share the same buyer** — a second, distinct
conversation rather than a resume of the first. Out of scope to solve for MVP, but the data
model (call record ↔ buyer identity) must eventually answer it. Flagged so it isn't lost.

### 5.8 Call script — the plan, the duration budget, and the script panel _(new, 2026-06-10)_

A **call script** is the explicit plan of what to cover across the whole call — the artifact a
seller mentally builds when prepping. Until now the planner (§5.3) only knew the *next* best
prompt; the script gives it a **backbone to walk** and gives the seller (and us, while building) a
plan to see. **Key separation: the script always exists and drives coaching internally; whether
the seller _sees_ it is a removable surface** (see _Visibility_).

**Two-layer generation — this is how a full script stays cheap (§7).**

| Layer                   | What                                                                                                                                                                                                          | When / cost                                                                                                          |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **1 — Skeleton (plan)** | An ordered list of **segments** (Open · Discovery · Problem · Value · Objections · Advance). Each: goal · the objectives it covers (→ ledger §5.3) · a **time box** (from duration) · its technique move. Coarse, ~few hundred tokens — *not* verbatim prompts. | Generated **once** at Start call; only the **tail** re-specializes when technique + product lock, or on a material signal (§5.3). |
| **2 — JIT wording**     | The current segment's actual two-tier cue (§5.1) + a small lookahead. This *is* the §5.3 chain — the chain is the JIT expansion of the skeleton's current segment.                                            | Generated **live**, per turn, on a **bounded** input (haiku-fast, §7).                                              |

So "generate a full script" never means "emit the whole call verbatim up front." It means **plan
coarse once, expand fine just-in-time, remember compactly** (the ledger). Context and latency stay
~constant regardless of call length (§7).

**Duration budget.** Call setup (§4.4) sets a scheduled duration — **v1: manual, default 30 min**.
The skeleton allocates it across segments by ratio (a 30-min default split, tunable `[QA]`). The
planner **paces against the clock**: a segment over its box with open objectives gets compressed to
its highest-value open item, or the planner signals "time to advance." The §5.1 status line shows
the phase + where we are against the budget.

**Technique + product make it better (the questions that prompted this).** The opening Discovery
segment is technique-neutral — it *picks* the technique. Once technique firms (Suggested →
Recommended → Locked) and the active product is matched (§5.3), the skeleton **tail re-specializes**:
Value / Objections / Advance segments are framed in the matched technique's moves and the
live-matched product's problem/ICP language. More grounding ⇒ a less generic arc.

**Tracking coverage (the ledger — _yes, our plan supports the answer-summary view_).** The script
panel renders the §5.3 **ledger**: each segment shows **done / open**, and each covered objective
shows the **prompt that was asked + a one-line answer digest**. The digest is **reused from the
SUCCESS takeaway the scorer already produces** (§5.2) — no extra model call. The same ledger is the
planner's compact rolling memory, so the coverage feature and the latency strategy are one
mechanism, not two.

**Visibility — build both, treat as removable (resolved 2026-06-10).**

- **Light pre-call plan.** Before Start call, a glanceable view of the skeleton arc (segments +
  time boxes). _(A small new pre-call surface — it nuances §0's "no pre-call screen": this is a
  plan preview, not per-lead enrichment.)_
- **Live script panel.** A **non-prominent**, collapsible reveal panel (the flagged 5th pill, §5.4)
  showing the arc + live done/open + asked-prompt + answer-digest progress.
- **Removable by design.** The expected client preference is a **clean "cockpit" — no script
  visible mid-call** (stay present; show only what's immediately relevant). So both surfaces sit
  behind a **flag**: built now (the builder wants to watch the system reason), expected to be
  **toggled off for the client demo** pending feedback. Removing the UI does **not** remove the
  script — the skeleton + ledger keep driving coaching regardless.

## 6. Data & contract

Three tiers of data:

- **Captured at onboarding — product / ICP / problem context.** The seller's products, each with
  its ICP and the problem it solves (`SellerProductContext`, §6.3), prefilled from the website
  scrape (mocked) and editable (§4.3). Grounds the call script; stored in the shared mock store
  (§11). _(Resolves the earlier "[FLAG] whether product info is needed at all" — it is, as of
  2026-06-10.)_
- **Derived live (during the call)** — buyer utterances → **buyer DISC/OCEAN**
  (`LeadPsychProfile`) + the **pipeline stage** + the **live-matched active product** (§5.3),
  built up from the transcript; the **call-script skeleton + ledger** (§5.8); coaching cues.
- **Seeded** (mock store) — any further supporting deal/company context needed for the demo, via
  `@pg/shared`.

Coaching prompts are grounded by the **buyer profile** (live buyer signals) + the
matched technique (selection logic:
[docs/sales-technique-matching.md](docs/sales-technique-matching.md)).

### 6.1 Psychological profile shapes — _reference, not gospel_

Provided by product; open to revision for the MVP. The buyer profile is built live from the
shared core plus the buyer specialization.

```ts
// Shared core
PsychProfile = {
  schema_version: number, // e.g. 1
  confidence: number, // 0–100
  disc: {
    primary: 'D' | 'I' | 'S' | 'C',
    secondary: 'D' | 'I' | 'S' | 'C' | null,
    rationale: string,
  },
  ocean: {
    openness: number,
    conscientiousness: number,
    extraversion: number,
    agreeableness: number,
    neuroticism: number,
  }, // each 0–100
  summary: string,
  generated_at: string, // ISO timestamp
};

// Buyer (built live during the call) — USED
LeadPsychProfile = { ...PsychProfile, buyer_readiness: number /* 0–100 */ };
```

**Buyer-directed discovery cues** are in §6.2. **Still to write:** the DISC/OCEAN **scoring
rules** (the technique-matching rules now live in
[docs/sales-technique-matching.md](docs/sales-technique-matching.md)). Part of the grounding
logic you'll provide (§1).

_TO FILL: exact field list once §4–5 settle._

### 6.2 Buyer discovery cues — _initial set, for prototyping_

The **buyer** profile is built **live** from how the buyer answers a few discovery questions
the seller weaves into the call. Three to start.

**Glanceability is still the rule, but cues render in two tiers** (§5.1): the **trigger** is
large and prominent — the thing the seller reads at a glance — and the full sentence appears
**beneath it, smaller, as a fallback example**, not a script to read verbatim. The seller
phrases the question in their own voice, for their own product. _(This updates the earlier
"full sentences never appear on screen" stance; the "Intent" column below is the basis for
that secondary example — final wording is **[QA]**.)_

| #   | Cue shown (glanceable)                     | Intent (off-screen)                      | Reads as                                                                                                                                                             |
| --- | ------------------------------------------ | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **"Why now?"**                             | What triggered looking at this now?      | **D** urgency · **C** specificity · **N**↑ pain-framed · **O**↑ opportunity- vs reaction-framed · **E** energy                                                       |
| 2   | **"How do they decide? Who's in?"**        | Their decision process + who weighs in   | DISC split: **D** solo/fast · **I** rallies people · **S** consensus/no-rush · **C** criteria/data · **Cons** structure · **E** collaborative · **A** defers/harmony |
| 3   | **"What's a win? What'd hold them back?"** | Ideal outcome + what makes them hesitant | **O** bold vs incremental · **D** ambition · **N**/**C** risk + proof needed · **A**/**S** disruption worry · skepticism ⇒ NEPQ                                      |

(_Key:_ DISC = D/I/S/C; OCEAN = **O**penness, **Cons**cientiousness, **E**xtraversion,
**A**greeableness, **N**euroticism. ↑ = high end.)

All four DISC letters and all five OCEAN traits get ≥2 independent reads across the set. The
"what'd hold them back" tail is the **sales-resistance** signal that tips matching toward
NEPQ. Asked back-to-back these feel like an interrogation, so the **when-to-prompt** mechanic
(scripted vs. passive vs. both) is still flagged (§3/§5); confidence starts **low** and firms
up as buyer speech accumulates (Suggested → Recommended → Locked).

### 6.3 Seller product / ICP context shape — _reference, mock; eventual DB swap_

Captured at onboarding (§4.3), held in the shared mock store, editable in-app. Mirrors
`@pg/shared`'s 1:N products-per-workspace model so it swaps to the real DB later without a
re-spec.

```ts
// One per product the seller sells. Prefilled from the website scrape (mocked), then edited.
SellerProduct = {
  id: string,
  name: string,
  description: string,        // what it is / does
  icp: string,               // who it's for (ideal customer profile)
  problem: string,           // the problem it solves
  source_url: string | null, // the scraped site, if prefilled this way
  is_primary: boolean,       // none primary at start; emerges over time (§4.3)
};

SellerProductContext = {
  products: SellerProduct[], // ≥1 to complete onboarding (§4.3 gating)
  // No active product is chosen up front. The call's product is inferred + confirmed
  // live (§5.3) and is NOT stored here — it belongs to the call/lead state.
};
```

**Live, not here:** the **active product** for a given call is matched live (§5.3) and lives in
the call/lead state, not in `SellerProductContext` — the context is the seller's static "what I
sell," the active product is a per-call derivation.

## 7. Real-time engine

**Speaker separation is the foundation** — captured at the source, not via ML diarization:
**seller = mic input, buyer(s) = system/output audio**, two distinct streams ⇒ deterministic
attribution. Per-stream VAD segments utterances; AEC (or headphones) prevents the buyer's
speaker-bleed from polluting the mic. Full design in
[docs/audio-capture-and-speaker-separation.md](docs/audio-capture-and-speaker-separation.md).

Pipeline: mic + system tap → per-stream VAD → AEC on mic → streaming STT (labeled finals)
→ coaching trigger (grounded by the live buyer profile + matched technique) → haiku cue → stream tokens
to overlay via Tauri events. **Recorded-audio fixture** runs the same path on a canned
2-channel recording — dev fixture + on-stage kill-switch. (Profiled by `latency-tests`,
PG-247..255.)

**Call-script cost model (2026-06-10).** Call duration does **not** grow live latency or context.
The script *skeleton* (§5.8) is generated **once** at Start call (off the hero's critical path,
during the opening beat) and re-specialized only on material signals. Live per-turn cue generation
reads a **bounded** input — product context + both profiles + matched technique + the skeleton +
the compact ledger + a short transcript window (not the whole transcript) — so its cost is
~constant whether the call runs 5 minutes or 50.

_TO FILL: target latencies, STT provider, coaching-model routing (backend vs direct)._

## 8. Platform subsystem (Rust / Tauri)

NSPanel overlay (PG-244), permissions flow (mic + system-audio + screen-share
invisibility), global hotkeys.

**Audio/speaker subsystem — designed:** see
[docs/audio-capture-and-speaker-separation.md](docs/audio-capture-and-speaker-separation.md).
Headlines: macOS-first via **Core Audio process taps** (`cidre`), mirror Pluely's
per-OS `speaker/` module structure, ring-buffer to async `Stream`, per-stream VAD, AEC +
headphone nudge.

_TO FILL: hotkey map, screen-share-invisibility approach._ (Permissions **UX** is now
spec'd in §4.2; this section owns the **implementation** — TCC entitlements per capture
path, the deep-link-to-pane mechanics, and the quit-&-reopen handling §4.2 calls out.)

## 9. Reference appendix

Read-for-approach only (clean-room; write fresh). **Both Pluely and Glass are GPL-3** —
strictly read-for-approach, never copy code or lift specific values. _(Corrected 2026-06-09:
Glass was previously mislabelled Apache-2.0 here and in §12; it is GPL-3. This tightens the
§12 token caveat — see there.)_

| Concern                 | Pluely (Tauri/Rust — primary ref)                                                   | Glass (Electron)                                       |
| ----------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------ |
| System-audio capture    | `src-tauri/src/speaker/{mod,macos,windows,linux}.rs` — Core Audio tap → ring buffer | `audioCore/listenCapture.js`, native `SystemAudioDump` |
| Speaker separation      | mic vs `SpeakerInput` output tap (two streams)                                      | `micMediaStream` vs `systemAudioContext`               |
| Echo cancellation       | (headphones / device choice)                                                        | `audioCore/aec.js` — `AecCancelEcho` (WASM)            |
| VAD / turn segmentation | `src/hooks/useSystemAudio.ts` (`VadConfig`)                                         | `isVoiceActive` RMS gate                               |
| STT wiring              | `src/lib/functions/stt.function.ts`                                                 | `features/listen/stt/sttService.js`                    |
| Overlay window          | `src-tauri/src/window.rs`, `capture.rs` (transparent always-on-top)                 | `src/ui/listen/*`                                      |

**Glass = the visual look-and-feel reference** — its design language (smoked-glass
translucency, fully-rounded pill chrome, near-monochrome + one accent) is codified as our
starting token set in §12. Cluely stays the **onboarding-flow** UX-feel reference (translucency,
minimalism). Both read-for-approach; we write fresh in our own stack (Tauri/React, not Glass's
Electron/Lit).

## 10. Out of scope for v1 (later layers)

**In scope but mocked (seeded, no backend):** the **minimal companion web app** (§11) —
account/auth, a saved-call vault, and a "past calls" review surface — on seeded mock data.
Its UI and experience are built for the MVP; only the data layer is faked.

**Genuinely deferred (real backend / full web app):** real auth + the real account,
server-side call storage, the **full** web app (11-step onboarding, Stripe hard paywall,
workbench, Buyers screen, Board view), pre-call enrichment screen, the full post-call recap
/ CRM Update Pack, **full product management** (product CRUD, primary-product workflows, the
real website-scrape chain), reframe flow.

_Note (2026-06-10):_ the desktop app **does** now capture **lightweight multi-product / ICP /
problem context** at onboarding (§4.3) — a mocked website-scrape prefill into the shared store.
That is distinct from the full product management deferred above; it's the minimal grounding the
call script needs, not a product CRUD surface.

## 11. Companion web app (minimal, mocked) — _in scope_

A small web surface that ships alongside the desktop Co-pilot. **Mocked: seeded data, no
backend, no real auth.** Building its UI + experience is part of the MVP; the data layer is
faked. Reuses the existing `apps/web` mock infrastructure (Zustand mock store + seed,
`@pg/shared`) but only the minimal slice below — the full web app (workbench, Buyers, Board,
11-step onboarding, Stripe) stays deferred (§10).

**Scope:**

- **Account / auth** — signup + login screens (mock auth; authenticates against nothing).
- **Saved-call vault** — a "past calls" list seeded with mock calls.
- **Call review (detail)** — open a saved call: transcript, coaching cues, buyer profile.

**Launch + lifecycle:** the **desktop app launches the web app** and the two run together.

- **Launch mechanism — resolved (2026-06-08): embedded webview window in the same Tauri
  app** (not the system browser). The desktop + web halves run in one process and **share a
  local store**, which is simpler and more reliable for a mock and dissolves the deeplink dance.
- **Desktop→web call handoff — resolved (2026-06-08):** because both halves share that local
  store, a finished call is **written to the shared store and the web app reads it live** — no
  file/deeplink round-trip. (Seeded calls still populate the vault for a fuller demo.)

_TO FILL: screen list + wireframes once §4–5 settle._

## 12. Visual design system (look & feel) — Glass-derived

The desktop app adopts **Glass's (pickle-com/glass) visual language**: dark **smoked-glass**
translucency, fully-rounded **pill** chrome, **near-monochrome** with a single accent, and
**system-sans** UI. This governs the whole desktop app — onboarding (§4) and the in-call
overlay (§5) alike; the companion web app (§11) inherits the palette where it fits. Values
below are **starting tokens** read-for-approach from Glass source (**GPL-3** — corrected
2026-06-09; see §9) and re-expressed in our Tauri/React stack — all **[QA]** against the real
app + PG brand. **[FLAG · legal]** Because Glass is GPL-3 (not Apache-2.0 as first assumed),
any *specific* lifted values here — the exact glass-rim gradient, blur radii, rgba opacity
steps — must be treated as clean-room re-expressed (our own values, chosen to look right),
not copied. The brand values (navy/cyan/coral) are ours already; re-derive the rest rather
than transcribing Glass's. This is also the first
concrete token set for the desktop app (the M7 design-tokens milestone was skipped).

### 12.1 Material & surfaces

- **Smoked glass** — dark translucent fills over a `backdrop-filter: blur(...)`. **Base tint
  locked to PG navy `#1a2e66`** (not neutral black): chrome and panels render at
  `rgba(26,46,102,0.6)`, so the app reads as **dark navy glass** over whatever is behind it.
  _(Deviation from Glass's `rgba(0,0,0,0.6)` starting value — a deliberate brand choice: slightly
  less chameleon over arbitrary backgrounds, more on-brand.)_
- **Glass rim** — a 1px light gradient border
  `linear-gradient(169deg, rgba(255,255,255,0.17) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.17) 100%)`,
  which catches like a beveled glass edge. Applied to the rail + panels.
- **Elevation** — panels float with `box-shadow: 0 8px 32px rgba(0,0,0,0.3)`.

### 12.2 Shape & geometry

- **Control rail = a capsule.** Full pill radius (`border-radius: 9999px`), ~47px tall, width
  hugs its content. Inner buttons are smaller pills (~26px tall). This is the §5.1 rail.
- **Panels = 12px rounded rectangles**, ~400px wide — the reveal panels (§5.4), the cue hero,
  and the end-of-call summary (§5.7).

### 12.3 Color

- **Near-monochrome** — white text at opacity steps on dark glass: primary
  `rgba(255,255,255,0.9)`, secondary `rgba(255,255,255,0.6)`, hover fills `0.14–0.18`.
- **One accent (locked) — PG cyan `#30f5fa`.** The single accent, marking the **seller's** own
  elements (own transcript bubbles, active toggle) — Glass's "blue = me" becomes "cyan = seller."
  Replaces the Glass iOS-blue starting value.
- **Alert (locked) — PG coral `#fc5e57`**, reserved for **End call** / recording / the no-audio
  state (§5.2). Per the "near-monochrome + one accent" law, coral is an **alert-only** color, **not**
  a general-purpose secondary — cyan stays the sole everyday accent.
- **Transcript bubbles** — seller (own) = accent; buyer = translucent white
  `rgba(255,255,255,0.1)` with text at `rgba(255,255,255,0.9)`.

### 12.4 Typography

- **UI font** — `'Helvetica Neue', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
  sans-serif`.
- **Transcript** — chat bubbles at 13px / line-height 1.5, `padding: 8px 12px`,
  `border-radius: 12px`, max-width 80%.
- **Two-tier cue (hero, §5.1)** mapped to the scale: **trigger** prominent (~20–24px, semibold),
  **example** secondary (~13px, `rgba(255,255,255,0.6)`).

### 12.5 Motion

- **~0.15s ease** show/hide/slide transitions (Glass's `.showing / .hiding / .sliding-in`
  cadence). The rail slides in; panels fade-and-expand **beneath** it.
- The cue lifecycle (§5.2) rides the same easing: PROMPT settles in · PROCESSING dims ·
  SUCCESS ✓ pulses — quick, never jarring.

### 12.6 Layout model

A **top-anchored floating pill** (the control rail, §5.1) is the persistent element; the cue
hero and reveal panels **drop beneath** it — exactly Glass's header→panel pattern. One panel at
a time (§5.4) keeps the surface calm.

## Open questions / FLAGS

- **[QA]** Phase-2 §5.3 starter specs — the material-signal catalog, per-technique cues, and
  cadence/suppression are **drafted as mock starting points** and need QA + review (incl. the
  two-tier cue wording, §5.1/§6.2) before build.
- **[FLAG · post-MVP]** Multiple calls, same buyer (§5.7) — representing separate
  conversations that share a buyer, distinct from resuming one call record.
- ~~**[QA · brand]** swap the iOS-blue accent for PG's brand accent~~ — **resolved
  (2026-06-08):** accent cyan `#30f5fa`, alert coral `#fc5e57`, base navy `#1a2e66` (§12). The
  remaining §12 values stay Glass-aligned starting tokens, still QA-able against the real app.
- **Resolved (2026-06-10):** product / ICP / problem context is **in v1** (§4.3) — reverses the
  2026-06-08 deferral. Multi-product, no up-front pick, website-scrape prefill (mocked), stored in
  the shared mock store; grounds the call script (§5.3).
- **[FLAG · confirm]** §4.3 **gating** — onboarding completes once ≥1 product's context exists,
  but the call doesn't gate on picking a product (matched live). My read of the "Other" gate
  answer; confirm vs. fully-skippable-with-generic-fallback.
- **[QA]** §5.3 **live product match** + the **discovery checklist** (answered/open tracking) are
  drafted as lightweight mock mechanics (2026-06-10) and need QA before build — including where
  the active-product confirmation chip surfaces and the milestone list per technique.
- **Resolved (2026-06-10):** the **call script** is now a first-class artifact (§5.8) — a
  duration-aware skeleton (default 30 min) the planner walks via JIT wording, with a ledger that
  tracks asked / skipped / superseded + a reused answer digest (§5.2). Script **surfaces**
  (pre-call plan + live panel) are **built but flagged/removable** — expected off for the client's
  clean-cockpit default; the engine uses the script regardless.
- **[QA]** §5.8 the **30-min segment split / time-box ratios** and the pacing rules (compress vs.
  signal-advance) are starter values — need QA + tuning.
- _(add as they arise)_
