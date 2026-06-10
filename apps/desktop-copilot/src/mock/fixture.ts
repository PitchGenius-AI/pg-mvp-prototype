import type { RealtimeEvent } from '@pg/shared';

// A scripted sequence of RealtimeEvents (PG-265 contract) that drives the overlay
// demo with no audio. This is a hand-authored stand-in for the recorded-audio
// fixture (PG-271) — the live Rust pipeline emits the identical shape on the same
// channel, so the overlay renderer never changes. The story is a cold-start
// discovery call: an introductions opener (rapport, seeds the profile early), then
// the three §6.2 discovery cues firm the buyer read, then the planner flips to a
// generated live cue once a technique is matched (Suggested → Recommended → Locked
// along the way). Discovery is four touches now — progress reads n/4. In the live
// phase the buyer raises pricing, so the planner fires a material-signal beat (§5.3)
// and re-plans the chain toward value — the no-key parity for the B1 re-plan path.

export interface FixtureEntry {
  /** Milliseconds from the start of the loop. */
  at: number;
  event: RealtimeEvent;
}

export const fixture: FixtureEntry[] = [
  { at: 0, event: { type: 'engine_state', state: 'listening', phase: 'discovery', discoveryProgress: { done: 0, total: 4 }, techniqueConfidence: null } },

  // — Intro: break the ice (rapport opener, seeds the profile)
  { at: 600, event: { type: 'cue', id: 'intro', phase: 'discovery', state: 'prompt', trigger: 'Break the ice', example: 'Before we dive in — tell me a bit about you and what you’re focused on right now.', technique: null, takeaway: null } },
  { at: 2200, event: { type: 'transcript', id: 'u1', speaker: 'seller', text: 'Before we get into it — tell me a bit about you and what you’re focused on these days.', tStart: 2.2, tEnd: 5.0, isFinal: true } },
  { at: 5200, event: { type: 'cue', id: 'intro', phase: 'discovery', state: 'processing', trigger: 'Break the ice', example: 'Before we dive in — tell me a bit about you and what you’re focused on right now.', technique: null, takeaway: null } },
  { at: 5600, event: { type: 'transcript', id: 'u2', speaker: 'buyer', text: 'Sure — I lead RevOps here, been in the seat about two years. Right now I’m heads-down on getting our new reps productive faster.', tStart: 5.6, tEnd: 9.8, isFinal: true } },
  { at: 10000, event: { type: 'cue', id: 'intro', phase: 'discovery', state: 'success', trigger: 'Break the ice', example: 'Before we dive in — tell me a bit about you and what you’re focused on right now.', technique: null, takeaway: 'read: warming up · RevOps lead' } },
  { at: 10200, event: { type: 'profile_update', subject: 'buyer', disc: { d: 40, i: 45, s: 52, c: 48, primaryType: 'I' }, ocean: { o: 50, c: 52, e: 56, a: 60, n: 48 }, summary: 'From the intro: warm and approachable, RevOps lead — communication style still forming.' } },
  { at: 10300, event: { type: 'technique_update', technique: 'spin', tier: 'suggested', rationale: 'Warm, approachable buyer — leaning SPIN: build the case through evidence at a low-pressure pace.' } },
  { at: 10800, event: { type: 'engine_state', state: 'listening', phase: 'discovery', discoveryProgress: { done: 1, total: 4 }, techniqueConfidence: 'suggested' } },

  // — Discovery cue 1: Why now?
  { at: 11400, event: { type: 'cue', id: 'd1', phase: 'discovery', state: 'prompt', trigger: 'Why now?', example: 'What made you start looking at this now, of all times?', technique: null, takeaway: null } },
  { at: 13000, event: { type: 'transcript', id: 'u3', speaker: 'seller', text: 'What’s got you exploring this now, of all times?', tStart: 13.0, tEnd: 15.8, isFinal: true } },
  { at: 16000, event: { type: 'cue', id: 'd1', phase: 'discovery', state: 'processing', trigger: 'Why now?', example: 'What made you start looking at this now, of all times?', technique: null, takeaway: null } },
  { at: 16400, event: { type: 'transcript', id: 'u4', speaker: 'buyer', text: 'Our manual process keeps breaking as we add reps — we dropped two deals last quarter because of it.', tStart: 16.4, tEnd: 20.8, isFinal: true } },
  { at: 21000, event: { type: 'cue', id: 'd1', phase: 'discovery', state: 'success', trigger: 'Why now?', example: 'What made you start looking at this now, of all times?', technique: null, takeaway: 'read: pain-driven · urgency ↑' } },
  { at: 21200, event: { type: 'profile_update', subject: 'buyer', disc: { d: 45, i: 38, s: 52, c: 56, primaryType: 'C' }, ocean: { o: 50, c: 58, e: 48, a: 56, n: 55 }, summary: 'Pain-driven and urgency-aware — the read is firming toward careful and analytical.' } },
  { at: 21300, event: { type: 'technique_update', technique: 'spin', tier: 'recommended', rationale: 'C-leaning, evidence-driven buyer: SPIN’s implication and need-payoff questions build the case through logic, without the tension that alienates a careful buyer.' } },
  { at: 21800, event: { type: 'engine_state', state: 'listening', phase: 'discovery', discoveryProgress: { done: 2, total: 4 }, techniqueConfidence: 'recommended' } },

  // — Discovery cue 2: How do they decide? Who's in?
  { at: 22400, event: { type: 'cue', id: 'd2', phase: 'discovery', state: 'prompt', trigger: "How do they decide? Who's in?", example: 'Walk me through how a decision like this gets made on your side.', technique: null, takeaway: null } },
  { at: 24000, event: { type: 'transcript', id: 'u5', speaker: 'seller', text: 'Help me understand how a call like this gets made internally.', tStart: 24.0, tEnd: 26.3, isFinal: true } },
  { at: 26800, event: { type: 'cue', id: 'd2', phase: 'discovery', state: 'processing', trigger: "How do they decide? Who's in?", example: 'Walk me through how a decision like this gets made on your side.', technique: null, takeaway: null } },
  { at: 27200, event: { type: 'transcript', id: 'u6', speaker: 'buyer', text: "It'd be me, but our COO signs off on anything over fifty K, and ops has to be on board.", tStart: 27.2, tEnd: 31.1, isFinal: true } },
  { at: 31500, event: { type: 'cue', id: 'd2', phase: 'discovery', state: 'success', trigger: "How do they decide? Who's in?", example: 'Walk me through how a decision like this gets made on your side.', technique: null, takeaway: 'read: consensus buyer · COO + ops' } },
  { at: 31700, event: { type: 'profile_update', subject: 'buyer', disc: { d: 40, i: 36, s: 64, c: 60, primaryType: 'S' }, ocean: { o: 50, c: 64, e: 46, a: 66, n: 56 }, summary: 'Consensus-driven — COO + ops weigh in; values buy-in over speed.' } },
  { at: 31800, event: { type: 'technique_update', technique: 'spin', tier: 'locked', rationale: 'S-leaning, evidence-driven buyer: SPIN’s implication and need-payoff questions build the case through logic, without the tension that alienates a steady or analytical buyer.' } },
  { at: 32300, event: { type: 'engine_state', state: 'listening', phase: 'discovery', discoveryProgress: { done: 3, total: 4 }, techniqueConfidence: 'locked' } },

  // — Discovery cue 3: What's a win? What'd hold them back?
  { at: 32900, event: { type: 'cue', id: 'd3', phase: 'discovery', state: 'prompt', trigger: "What's a win? What'd hold them back?", example: "If this works, what does good look like — and what'd give you pause?", technique: null, takeaway: null } },
  { at: 34500, event: { type: 'transcript', id: 'u7', speaker: 'seller', text: 'If we did this, what would a win look like — and what would worry you?', tStart: 34.5, tEnd: 37.3, isFinal: true } },
  { at: 37500, event: { type: 'cue', id: 'd3', phase: 'discovery', state: 'processing', trigger: "What's a win? What'd hold them back?", example: "If this works, what does good look like — and what'd give you pause?", technique: null, takeaway: null } },
  { at: 37900, event: { type: 'transcript', id: 'u8', speaker: 'buyer', text: 'A win is reps ramping in days, not weeks. The worry is buying another tool nobody adopts.', tStart: 37.9, tEnd: 42.0, isFinal: true } },
  { at: 42200, event: { type: 'cue', id: 'd3', phase: 'discovery', state: 'success', trigger: "What's a win? What'd hold them back?", example: "If this works, what does good look like — and what'd give you pause?", technique: null, takeaway: 'read: outcome-focused · adoption risk' } },
  { at: 42400, event: { type: 'profile_update', subject: 'buyer', disc: { d: 40, i: 35, s: 70, c: 65, primaryType: 'S' }, ocean: { o: 50, c: 68, e: 45, a: 72, n: 58 }, summary: 'Consensus-driven and risk-aware — values proof and a low-pressure pace.' } },
  { at: 42500, event: { type: 'technique_update', technique: 'spin', tier: 'locked', rationale: 'S-leaning, evidence-driven buyer: SPIN’s implication and need-payoff questions build the case through logic, without the tension that alienates a steady or analytical buyer.' } },

  // — Discovery complete → Live phase, generated chain (head shown)
  { at: 43100, event: { type: 'engine_state', state: 'listening', phase: 'live', discoveryProgress: null, techniqueConfidence: 'locked' } },
  { at: 43700, event: { type: 'cue', id: 'live-1', phase: 'live', state: 'prompt', trigger: "What's it costing?", example: "If that doesn't change, what does it cost you over the next year?", technique: 'spin', takeaway: null } },
  { at: 45300, event: { type: 'transcript', id: 'u9', speaker: 'seller', text: "What's that actually costing you over a year if it doesn't change?", tStart: 45.3, tEnd: 48.0, isFinal: true } },
  { at: 48000, event: { type: 'cue', id: 'live-1', phase: 'live', state: 'processing', trigger: "What's it costing?", example: "If that doesn't change, what does it cost you over the next year?", technique: 'spin', takeaway: null } },
  { at: 48400, event: { type: 'transcript', id: 'u10', speaker: 'buyer', text: 'Probably three or four hires worth of lost productivity, honestly.', tStart: 48.4, tEnd: 51.5, isFinal: true } },
  { at: 51700, event: { type: 'cue', id: 'live-1', phase: 'live', state: 'success', trigger: "What's it costing?", example: "If that doesn't change, what does it cost you over the next year?", technique: 'spin', takeaway: 'buying signal · quantified pain' } },
  { at: 51900, event: { type: 'profile_update', subject: 'buyer', disc: { d: 42, i: 35, s: 70, c: 66, primaryType: 'S' }, ocean: { o: 52, c: 70, e: 45, a: 72, n: 56 }, summary: 'Consensus-driven, risk-aware, and now cost-motivated — proof + ROI will close.' } },
  { at: 52000, event: { type: 'technique_update', technique: 'spin', tier: 'locked', rationale: 'S-leaning, evidence-driven buyer: SPIN’s implication and need-payoff questions build the case through logic, without the tension that alienates a steady or analytical buyer.' } },

  // — Material signal (§5.3): the buyer raises pricing → the planner catches it,
  // surfaces a brief acknowledgment beat, and re-plans the chain toward value (the
  // queued steady-state cue is replaced; only the new head reaches the hero).
  { at: 53000, event: { type: 'transcript', id: 'u11', speaker: 'buyer', text: 'Before we go any further — what does something like this actually cost?', tStart: 53.0, tEnd: 56.4, isFinal: true } },
  { at: 53300, event: { type: 'material_signal', signal: 'pricing' } },
  // The re-plan generation runs (the beat lingers); then the signal-shaped head lands.
  { at: 55100, event: { type: 'engine_state', state: 'listening', phase: 'live', discoveryProgress: null, techniqueConfidence: 'locked' } },
  { at: 55400, event: { type: 'cue', id: 'live-2', phase: 'live', state: 'prompt', trigger: 'Anchor on value first', example: "Before we talk price — what's it costing you to stay where you are for another year?", technique: 'spin', takeaway: null } },
  { at: 57000, event: { type: 'transcript', id: 'u12', speaker: 'seller', text: 'Before we get to price — what would staying put cost you over the next year?', tStart: 57.0, tEnd: 59.8, isFinal: true } },
  { at: 59900, event: { type: 'cue', id: 'live-2', phase: 'live', state: 'processing', trigger: 'Anchor on value first', example: "Before we talk price — what's it costing you to stay where you are for another year?", technique: 'spin', takeaway: null } },
  { at: 60300, event: { type: 'transcript', id: 'u13', speaker: 'buyer', text: "Fair point — honestly it's probably a couple hundred K a year in lost productivity.", tStart: 60.3, tEnd: 64.0, isFinal: true } },
  { at: 64600, event: { type: 'cue', id: 'live-2', phase: 'live', state: 'success', trigger: 'Anchor on value first', example: "Before we talk price — what's it costing you to stay where you are for another year?", technique: 'spin', takeaway: 'pricing · value anchored' } },
  { at: 64800, event: { type: 'profile_update', subject: 'buyer', disc: { d: 44, i: 35, s: 68, c: 66, primaryType: 'S' }, ocean: { o: 52, c: 70, e: 46, a: 70, n: 54 }, summary: 'Cost-aware and value-receptive — frame ROI before price and the number lands softer.' } },
  { at: 64900, event: { type: 'technique_update', technique: 'spin', tier: 'locked', rationale: 'S-leaning, evidence-driven buyer: anchor on the cost of inaction (SPIN implication) before the price so value frames the number.' } },
];

// When the loop restarts (after the last event + a breath).
export const FIXTURE_LOOP_MS = 67000;
