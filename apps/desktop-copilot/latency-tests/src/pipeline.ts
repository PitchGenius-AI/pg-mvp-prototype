import type { RunCollector } from './timing';
import type { Architecture, TranscriptChunk } from './types';

export interface PipelineContext {
  chunk: TranscriptChunk;
  // Path to the chunk's audio fixture, for pipelines that run real transcription.
  audioPath?: string;
  collector: RunCollector;
  signal?: AbortSignal;
}

export interface PipelineRunResult {
  firstTokenOnScreenMs: number | null;
  fullPromptMs: number | null;
  criticalPathTotalMs: number | null;
  backgroundRefreshMs?: number | null;
  generatedText: string;
  ok: boolean;
  error?: string;
}

// A pluggable pipeline. Concrete implementations (naive-serial, decoupled) live
// in baselines/ and optimized/ and are added in Epics 2-3. The harness only
// depends on this interface, so swapping architectures/models needs no runner change.
export interface Pipeline {
  architecture: Architecture;
  model: string; // generation-model label recorded in results
  run(ctx: PipelineContext): Promise<PipelineRunResult>;
}
