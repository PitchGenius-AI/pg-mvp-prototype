import { randomUUID } from 'node:crypto';
import { machineId as defaultMachineId } from './config';
import { pingEndpoint } from './net';
import type { Pipeline } from './pipeline';
import { ResultWriter, RunCollector } from './timing';
import type { TranscriptChunk } from './types';

export interface RunSetOptions {
  pipeline: Pipeline;
  chunks: TranscriptChunk[];
  // Loop the chunk set N times (spec 2.2 uses 5 for an honest P95 over 100 runs).
  repeat?: number;
  // Per-repeat perturbation so identical prompts don't get unrealistic cache hits.
  perturb?: (chunk: TranscriptChunk, repeatIndex: number) => TranscriptChunk;
  audioPathFor?: (chunk: TranscriptChunk) => string | undefined;
  machineId?: string;
  onProgress?: (done: number, total: number, result: { firstTokenOnScreenMs: number | null; ok: boolean }) => void;
}

export interface RunSetSummary {
  resultsPath: string;
  total: number;
  ok: number;
  failed: number;
}

// Generic runner: loops chunks through ANY pipeline, times each run via a
// RunCollector, and appends JSONL records. This is the "configurable pipeline"
// core (PG-252) shared by every baseline/optimized/multi-model script.
export async function runSet(opts: RunSetOptions): Promise<RunSetSummary> {
  const repeat = opts.repeat ?? 1;
  const machine = opts.machineId ?? defaultMachineId();
  const startIso = new Date().toISOString();
  const modelTag = opts.pipeline.model.replace(/[:/]/g, '-');
  const writer = new ResultWriter(`${opts.pipeline.architecture}_${modelTag}_${startIso}`);
  const network = await pingEndpoint();

  const queue: TranscriptChunk[] = [];
  for (let r = 0; r < repeat; r++) {
    for (const chunk of opts.chunks) {
      queue.push(opts.perturb ? opts.perturb(chunk, r) : chunk);
    }
  }

  const total = queue.length;
  let ok = 0;
  let failed = 0;

  for (let i = 0; i < queue.length; i++) {
    const chunk = queue[i]!;
    const collector = new RunCollector({
      writer,
      runId: randomUUID(),
      machineId: machine,
      architecture: opts.pipeline.architecture,
      model: opts.pipeline.model,
      chunkId: chunk.id,
      chunkCategory: chunk.category,
      network,
    });

    let result;
    try {
      result = await opts.pipeline.run({
        chunk,
        audioPath: opts.audioPathFor?.(chunk),
        collector,
      });
    } catch (err) {
      result = {
        firstTokenOnScreenMs: null,
        fullPromptMs: null,
        criticalPathTotalMs: null,
        backgroundRefreshMs: null,
        generatedText: '',
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }

    await collector.finish({
      firstTokenOnScreenMs: result.firstTokenOnScreenMs,
      fullPromptMs: result.fullPromptMs,
      criticalPathTotalMs: result.criticalPathTotalMs,
      backgroundRefreshMs: result.backgroundRefreshMs ?? null,
      ok: result.ok,
      error: result.error,
    });

    if (result.ok) ok++;
    else failed++;
    opts.onProgress?.(i + 1, total, { firstTokenOnScreenMs: result.firstTokenOnScreenMs, ok: result.ok });
  }

  return { resultsPath: writer.path, total, ok, failed };
}
