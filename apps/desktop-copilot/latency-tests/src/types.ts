// Shared types for the latency-validation harness. The string unions mirror the
// canonical contract in @pg/shared (packages/shared/src/enums.ts) but are inlined
// to keep the harness decoupled from the app's build graph.

export type ReadinessState =
  | 'unaware'
  | 'problem_aware'
  | 'diagnosis_aligned'
  | 'solution_curious'
  | 'solution_confident'
  | 'stakeholder_validation_needed'
  | 'commercially_ready'
  | 'commit_ready'
  | 'at_risk';

export type SalesTechnique = 'challenger' | 'spin' | 'nepq';

export type ChunkCategory =
  | 'objection'
  | 'question'
  | 'hedging'
  | 'commit_signal'
  | 'generic';

// The cached per-opportunity context the background workers maintain. The
// critical path reads this at call time; it never recomputes it inline.
export interface OpportunityState {
  matchedTechnique: SalesTechnique;
  readinessState: ReadinessState;
  readinessStateGoal: ReadinessState;
  lastPrompt: string;
  evidenceSummary: string;
}

export interface TranscriptChunk {
  id: string;
  category: ChunkCategory;
  text: string;
  state: OpportunityState;
}

export type Architecture = 'naive-serial' | 'decoupled';

export interface NetworkSample {
  endpoint: string;
  pingMs: number | null;
}

// One phase span within a single chunk-run (diagnostic detail).
export interface PhaseRecord {
  kind: 'phase';
  runId: string;
  machineId: string;
  architecture: Architecture;
  model: string;
  chunkId: string;
  phase: string;
  startMs: number;
  endMs: number;
  durationMs: number;
  ok: boolean;
  error?: string;
}

// One headline record per chunk-run. P50/P95/P99 are computed over these.
export interface RunRecord {
  kind: 'run';
  runId: string;
  machineId: string;
  architecture: Architecture;
  model: string;
  chunkId: string;
  chunkCategory: ChunkCategory;
  ts: number;
  network: NetworkSample;
  // Headline: chunk-arrival -> first generation token visible.
  firstTokenOnScreenMs: number | null;
  // chunk-arrival -> full prompt rendered.
  fullPromptMs: number | null;
  // Total critical-path time. Equal to fullPromptMs for current pipelines;
  // kept distinct so a future pipeline can render before generation completes.
  criticalPathTotalMs: number | null;
  // Decoupled only: time for a background scoring refresh to land (OFF the
  // critical path). null for naive-serial.
  backgroundRefreshMs: number | null;
  ok: boolean;
  error?: string;
}

export type TimingRecord = PhaseRecord | RunRecord;
