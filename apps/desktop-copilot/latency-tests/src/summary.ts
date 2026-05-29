import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { RESULTS_DIR } from './config';
import type { TimingRecord } from './types';

// Linear-interpolated percentile over an unsorted array. Returns null if empty.
export function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0]!;
  const rank = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sorted[lo]!;
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (rank - lo);
}

export interface Group {
  architecture: string;
  model: string;
  machineId: string;
  runs: number;
  ok: number;
  failed: number;
  firstToken: number[];
  fullPrompt: number[];
  background: number[];
}

export function summarize(records: TimingRecord[]): Group[] {
  const groups = new Map<string, Group>();
  for (const rec of records) {
    if (rec.kind !== 'run') continue;
    const key = `${rec.architecture}|${rec.model}|${rec.machineId}`;
    let g = groups.get(key);
    if (!g) {
      g = {
        architecture: rec.architecture,
        model: rec.model,
        machineId: rec.machineId,
        runs: 0,
        ok: 0,
        failed: 0,
        firstToken: [],
        fullPrompt: [],
        background: [],
      };
      groups.set(key, g);
    }
    g.runs++;
    if (rec.ok) g.ok++;
    else g.failed++;
    if (rec.firstTokenOnScreenMs != null) g.firstToken.push(rec.firstTokenOnScreenMs);
    if (rec.fullPromptMs != null) g.fullPrompt.push(rec.fullPromptMs);
    if (rec.backgroundRefreshMs != null) g.background.push(rec.backgroundRefreshMs);
  }
  return [...groups.values()].sort(
    (a, b) => a.architecture.localeCompare(b.architecture) || a.model.localeCompare(b.model),
  );
}

function ms(n: number | null): string {
  return n == null ? '—' : `${Math.round(n)}`;
}

function pad(s: string, w: number): string {
  return s.length >= w ? s : s + ' '.repeat(w - s.length);
}

export function renderTable(groups: Group[]): string {
  if (groups.length === 0) return 'No run records found.';
  const headers = ['architecture', 'model', 'machine', 'n', 'fail', 'FT p50', 'FT p95', 'FT p99', 'Full p95', 'Bg p95'];
  const rows = groups.map((g) => [
    g.architecture,
    g.model,
    g.machineId,
    String(g.runs),
    String(g.failed),
    ms(percentile(g.firstToken, 50)),
    ms(percentile(g.firstToken, 95)),
    ms(percentile(g.firstToken, 99)),
    ms(percentile(g.fullPrompt, 95)),
    g.background.length ? ms(percentile(g.background, 95)) : '—',
  ]);
  const widths = headers.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i]!.length)));
  const line = (cells: string[]) => cells.map((c, i) => pad(c, widths[i]!)).join('  ');
  const sep = widths.map((w) => '-'.repeat(w)).join('  ');
  return [line(headers), sep, ...rows.map(line)].join('\n') + '\n\n(times in ms; FT = first-token-on-screen, Bg = background scoring refresh)';
}

async function loadFiles(files: string[]): Promise<TimingRecord[]> {
  const out: TimingRecord[] = [];
  for (const f of files) {
    const text = await readFile(f, 'utf8');
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      out.push(JSON.parse(trimmed) as TimingRecord);
    }
  }
  return out;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  let files: string[];
  if (args.length > 0) {
    files = args.map((a) => resolve(process.cwd(), a));
  } else {
    const entries = await readdir(RESULTS_DIR).catch(() => [] as string[]);
    files = entries.filter((f) => f.endsWith('.jsonl')).map((f) => resolve(RESULTS_DIR, f));
  }
  if (files.length === 0) {
    console.log(`No .jsonl result files found in ${RESULTS_DIR}. Run a pipeline first.`);
    return;
  }
  const records = await loadFiles(files);
  console.log(`Summarizing ${records.length} records from ${files.length} file(s):\n`);
  console.log(renderTable(summarize(records)));
}

// Run only when invoked directly (tsx src/summary.ts [file ...]), not when imported.
const invokedPath = process.argv[1];
if (invokedPath && pathToFileURL(resolve(invokedPath)).href === import.meta.url) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
