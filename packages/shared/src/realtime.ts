import { z } from 'zod';
import { salesTechniqueSchema } from './enums';
import { discProfileSchema, oceanProfileSchema } from './precall';

// Realtime event contract for the desktop Co-pilot (M22 — UX_SPEC §5, §7;
// docs/audio-capture-and-speaker-separation.md §5). This is the deterministic
// seam between the Rust real-time engine (capture → VAD → STT → coaching) and
// the React overlay: Rust emits these events over a single Tauri channel and the
// overlay is pure presentation. Both the live pipeline and the recorded-audio
// fixture (PG-271) emit the identical shape, so the overlay never knows which
// producer is upstream.
//
// The Rust structs in `src-tauri` mirror these schemas (same discipline as the
// db-enum mirroring in packages/db). Keep them in lockstep.
//
// Profile-update event (the Buyer panel filling live, §5.4) — LANDED with the
// M23 live-scoring planner. It carries the precall.ts DISC/OCEAN shapes (the ones
// the overlay already renders), NOT the richer §6.1 `LeadPsychProfile`: the
// secondary/rationale fields + `buyer_readiness`/pipeline-stage are still deferred
// until that shape settles, so we keep the wire contract to what the panel needs
// today (disc + ocean + a narrative summary). See profileUpdateEventSchema below.

// The single Tauri event channel the engine emits on. The overlay subscribes once
// and discriminates on the `type` field below.
export const REALTIME_EVENT_CHANNEL = 'pg:realtime';

// Speaker attribution is source-based, never ML-diarized: seller = mic input,
// buyer = system/output audio (audio doc §1). The system stream mixes all remote
// participants, so this is a clean seller-vs-buyer(s) split, not buyer-A vs buyer-B.
export const speakers = ['seller', 'buyer'] as const;
export const speakerSchema = z.enum(speakers);
export type Speaker = z.infer<typeof speakerSchema>;

// The two planner modes (§5.3). Phase 1 runs the fixed §6.2 discovery script;
// Phase 2 runs a generated next-best-task chain. Same task loop either way.
export const cuePhases = ['discovery', 'live'] as const;
export const cuePhaseSchema = z.enum(cuePhases);
export type CuePhase = z.infer<typeof cuePhaseSchema>;

// A single cue's lifecycle (§5.2). Idle and no-audio are engine-level states (see
// engineStates below), not per-cue — the overlay renders exactly one cue's state
// at a time.
export const cueStates = ['prompt', 'processing', 'success'] as const;
export const cueStateSchema = z.enum(cueStates);
export type CueState = z.infer<typeof cueStateSchema>;

// Engine/status-line state (§5.1, §5.2). `no_audio` must be loud + recoverable —
// a silently-broken mic/system-audio kills the call.
export const engineStates = ['idle', 'listening', 'processing', 'no_audio'] as const;
export const engineStateSchema = z.enum(engineStates);
export type EngineState = z.infer<typeof engineStateSchema>;

// Technique-confidence creep (§6.2): the matched technique firms up as buyer
// speech accumulates. Distinct from `confidenceLevel` (low/medium/high) in enums.ts.
export const confidenceTiers = ['suggested', 'recommended', 'locked'] as const;
export const confidenceTierSchema = z.enum(confidenceTiers);
export type ConfidenceTier = z.infer<typeof confidenceTierSchema>;

// A speaker-labeled transcript chunk from streaming STT. Boundaries come from
// per-stream VAD (audio doc §4); `isFinal` distinguishes interim partials from
// finals (finals drive coaching triggers). Times are seconds from call start.
export const transcriptEventSchema = z.object({
  type: z.literal('transcript'),
  id: z.string(),
  speaker: speakerSchema,
  text: z.string(),
  tStart: z.number(),
  tEnd: z.number(),
  isFinal: z.boolean(),
});
export type TranscriptEvent = z.infer<typeof transcriptEventSchema>;

// A coaching cue in its lifecycle. `id` is stable across the cue's state changes
// (prompt → processing → success) so the overlay can animate one element. Rendered
// two-tier (§5.1): `trigger` is the glanceable line, `example` the full-sentence
// fallback (a prompt, not a verbatim script). `technique` is null during neutral
// discovery / while only Suggested; `takeaway` is the success-only one-glance read.
export const cueEventSchema = z.object({
  type: z.literal('cue'),
  id: z.string(),
  phase: cuePhaseSchema,
  state: cueStateSchema,
  trigger: z.string(),
  example: z.string(),
  technique: salesTechniqueSchema.nullable(),
  takeaway: z.string().nullable(),
});
export type CueEvent = z.infer<typeof cueEventSchema>;

// Engine/status-line update (§5.1). `discoveryProgress` drives the "Discovery 2/3"
// indicator (null once Live); `techniqueConfidence` drives the Suggested →
// Recommended → Locked creep (null before a technique is matched).
export const engineStateEventSchema = z.object({
  type: z.literal('engine_state'),
  state: engineStateSchema,
  phase: cuePhaseSchema,
  discoveryProgress: z
    .object({ done: z.number().int(), total: z.number().int() })
    .nullable(),
  techniqueConfidence: confidenceTierSchema.nullable(),
});
export type EngineStateEvent = z.infer<typeof engineStateEventSchema>;

// Whose profile a profile_update carries. The seller profile is scored once at
// onboarding (§4.3); only the buyer profile is (re)scored live during the call,
// but the field is explicit so a future live seller re-score needs no new event.
export const profileSubjects = ['buyer', 'seller'] as const;
export const profileSubjectSchema = z.enum(profileSubjects);
export type ProfileSubject = z.infer<typeof profileSubjectSchema>;

// A live profile (re)score (§5.4 Buyer panel "watch it learn"). Emitted each time
// the planner scores a buyer answer: the engine re-scores from the cumulative
// answers so the numbers visibly firm up across the discovery cues. `disc`/`ocean`
// reuse the precall.ts shapes the overlay's ProfileBody already renders; `summary`
// is the short narrative read. The Suggested→Recommended→Locked confidence creep
// and Discovery n/total stay on engineStateEventSchema — this event is just the bars.
export const profileUpdateEventSchema = z.object({
  type: z.literal('profile_update'),
  subject: profileSubjectSchema,
  disc: discProfileSchema,
  ocean: oceanProfileSchema,
  summary: z.string(),
});
export type ProfileUpdateEvent = z.infer<typeof profileUpdateEventSchema>;

// A live technique match (§5.4 Technique panel) — the rules matcher's
// SPIN/Challenger/NEPQ pick + confidence tier + a one-line rationale, derived from
// the buyer read and emitted alongside each profile_update so the Technique panel
// fills live the same way the Buyer panel does (replacing the canned reasoning).
// `technique` reuses the enums.ts salesTechniqueSchema; `tier` is the same
// Suggested→Recommended→Locked creep the status line shows (confidenceTierSchema).
export const techniqueUpdateEventSchema = z.object({
  type: z.literal('technique_update'),
  technique: salesTechniqueSchema,
  tier: confidenceTierSchema,
  rationale: z.string(),
});
export type TechniqueUpdateEvent = z.infer<typeof techniqueUpdateEventSchema>;

// The four buyer-side material signals (§5.3 catalog). The buyer-score haiku call
// classifies each turn into one of these (folded into the same round-trip — no
// second call), and a material label regenerates the live coaching chain toward it.
// The two seller-side VAD signals (monologue / long silence) are a later increment.
export const materialSignals = [
  'objection',
  'buying_signal',
  'new_stakeholder',
  'pricing',
] as const;
export const materialSignalSchema = z.enum(materialSignals);
export type MaterialSignal = z.infer<typeof materialSignalSchema>;

// A material-signal beat (§5.3) — the planner caught something in the buyer's speech
// and is regenerating the chain toward it. Surfaced as a brief acknowledgment status
// beat ("the engine reacted"); the chain reshuffle stays off-screen (only the new
// head reaches the hero, §5.1). `signal` is one of the four buyer-side labels; the
// overlay maps it to display text. Mirrors the Rust `MaterialSignalEvent`.
export const materialSignalEventSchema = z.object({
  type: z.literal('material_signal'),
  signal: materialSignalSchema,
});
export type MaterialSignalEvent = z.infer<typeof materialSignalEventSchema>;

// The wire event: one discriminated union over `type` carried on
// REALTIME_EVENT_CHANNEL. The overlay validates with this and switches on `type`.
export const realtimeEventSchema = z.discriminatedUnion('type', [
  transcriptEventSchema,
  cueEventSchema,
  engineStateEventSchema,
  profileUpdateEventSchema,
  techniqueUpdateEventSchema,
  materialSignalEventSchema,
]);
export type RealtimeEvent = z.infer<typeof realtimeEventSchema>;
