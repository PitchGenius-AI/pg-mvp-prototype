import { appendFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { RESULTS_DIR } from './config';
import type { Architecture, ChunkCategory, NetworkSample, PhaseRecord, RunRecord, TimingRecord } from './types';

// Appends timing records to results/{run-label}.jsonl, one JSON object per line.
export class ResultWriter {
  readonly path: string;
  private ready: Promise<unknown>;
  // Serialize appends so concurrent background-worker writes can't interleave a line.
  private tail: Promise<unknown> = Promise.resolve();

  constructor(runLabel: string) {
    const safe = runLabel.replace(/[:.]/g, '-');
    this.path = resolve(RESULTS_DIR, `${safe}.jsonl`);
    this.ready = mkdir(RESULTS_DIR, { recursive: true });
  }

  async write(record: TimingRecord): Promise<void> {
    const line = JSON.stringify(record) + '\n';
    this.tail = this.tail
      .then(() => this.ready)
      .then(() => appendFile(this.path, line, 'utf8'));
    await this.tail;
  }
}

export interface RunCollectorInit {
  writer: ResultWriter;
  runId: string;
  machineId: string;
  architecture: Architecture;
  model: string;
  chunkId: string;
  chunkCategory: ChunkCategory;
  network: NetworkSample;
}

// Collects per-phase spans for one chunk-run and emits the headline RunRecord.
// t0 is fixed at construction = "chunk arrival" on the critical path.
export class RunCollector {
  readonly t0: number;
  private init: RunCollectorInit;

  constructor(init: RunCollectorInit) {
    this.init = init;
    this.t0 = performance.now();
  }

  // Wrap an awaited phase, recording its span. Records a failed span then re-throws.
  async phase<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    try {
      const out = await fn();
      await this.record(name, start, performance.now(), true);
      return out;
    } catch (err) {
      await this.record(name, start, performance.now(), false, errMsg(err));
      throw err;
    }
  }

  // Record an instant relative to t0 (e.g. first token); returns the offset in ms.
  async mark(name: string): Promise<number> {
    const now = performance.now();
    await this.record(name, this.t0, now, true);
    return now - this.t0;
  }

  msSinceArrival(): number {
    return performance.now() - this.t0;
  }

  private async record(phase: string, start: number, end: number, ok: boolean, error?: string): Promise<void> {
    const rec: PhaseRecord = {
      kind: 'phase',
      runId: this.init.runId,
      machineId: this.init.machineId,
      architecture: this.init.architecture,
      model: this.init.model,
      chunkId: this.init.chunkId,
      phase,
      startMs: round1(start),
      endMs: round1(end),
      durationMs: round1(end - start),
      ok,
      ...(error ? { error } : {}),
    };
    await this.init.writer.write(rec);
  }

  async finish(result: {
    firstTokenOnScreenMs: number | null;
    fullPromptMs: number | null;
    criticalPathTotalMs: number | null;
    backgroundRefreshMs?: number | null;
    ok: boolean;
    error?: string;
  }): Promise<void> {
    const rec: RunRecord = {
      kind: 'run',
      runId: this.init.runId,
      machineId: this.init.machineId,
      architecture: this.init.architecture,
      model: this.init.model,
      chunkId: this.init.chunkId,
      chunkCategory: this.init.chunkCategory,
      ts: Date.now(),
      network: this.init.network,
      firstTokenOnScreenMs: round1n(result.firstTokenOnScreenMs),
      fullPromptMs: round1n(result.fullPromptMs),
      criticalPathTotalMs: round1n(result.criticalPathTotalMs),
      backgroundRefreshMs: result.backgroundRefreshMs == null ? null : round1n(result.backgroundRefreshMs),
      ok: result.ok,
      ...(result.error ? { error: result.error } : {}),
    };
    await this.init.writer.write(rec);
  }
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
function round1n(n: number | null): number | null {
  return n == null ? null : round1(n);
}
function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
