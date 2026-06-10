import type { EngineStateEvent, TechniqueUpdateEvent } from '@pg/shared';
import type { DemoProfile } from './mock/profiles';

// Frontend-only call-session layer (UX_SPEC §5.7, §5.1 timer). This is presentation
// state the overlay derives — NOT part of the Rust event contract: the engine emits
// the same wire events whether or not a summary is shown, and both the live hook
// (useRealtimeEngine) and the scripted fixture (useFixturePlayer) compute these the
// same way, so the overlay stays a pure renderer.
//
// v1 ships the basic summary card only (the full post-call analysis is out of scope).
// "Resume" (re-entering the call record) is the next sub-increment — the `view` model
// below leaves room for it ('summary' → back to 'live') and End deliberately does NOT
// clear the reduced PlayerState, so resuming the record later isn't precluded.

// Discovery is four touches (the intro opener + the three §6.2 cues). Mirrors the
// planner's `discovery_cues()` and the fixture; used to fill in the summary when the
// call reached the live phase (all discovery cues completed).
export const DISCOVERY_TOTAL = 4;

// The overlay's top-level view. `precall` is the idle bar (awaiting Start call);
// `live` is the in-call hero/loop; `summary` is the §5.7 end-of-call card. A future
// Resume moves 'summary' → 'live' without clearing the record.
export type CallView = 'precall' | 'live' | 'summary';

// The §5.7 basic summary — every field derived from the reduced PlayerState plus two
// tracked extras (the call clock + how far discovery got). `pipelineStage` is null by
// design for v1: the pipeline-stage read is a web/readiness concept not yet in the
// desktop wire contract (§6), so the card renders an honest "not yet read" rather than
// inventing a stage. Threading a real stage read is a later increment.
export interface CallSummary {
  durationMs: number;
  discoveryCompleted: number;
  discoveryTotal: number;
  /** Final live buyer DISC/OCEAN + one-liner (`summary`); null if never scored. */
  buyer: DemoProfile | null;
  /** Final matched technique + confidence tier + rationale; null if never matched. */
  technique: TechniqueUpdateEvent | null;
  pipelineStage: null;
}

// Accumulate "how many discovery cues completed" from the engine-state stream. During
// discovery `discoveryProgress.done` climbs 0→4; once the engine flips to the live
// phase that field goes null, so reaching `live` means all discovery cues completed.
// Pure + monotonic so either producer can fold it over its events.
export function trackDiscovery(prev: number, e: EngineStateEvent): number {
  if (e.phase === 'live') return DISCOVERY_TOTAL;
  return Math.max(prev, e.discoveryProgress?.done ?? 0);
}

// Build the §5.7 summary snapshot from the final call state. Taken at End so later
// stray events (e.g. the engine's `idle` echo) can't mutate the displayed card.
export function buildCallSummary(opts: {
  buyer: DemoProfile | null;
  technique: TechniqueUpdateEvent | null;
  durationMs: number;
  discoveryCompleted: number;
}): CallSummary {
  return {
    durationMs: opts.durationMs,
    discoveryCompleted: opts.discoveryCompleted,
    discoveryTotal: DISCOVERY_TOTAL,
    buyer: opts.buyer,
    technique: opts.technique,
    pipelineStage: null,
  };
}

// `m:ss` for the rail's live timer (§5.1) and the summary duration. Clamps negatives
// to 0 so a not-yet-started clock reads 0:00.
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
