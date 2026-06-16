// Resilience + concurrency primitives shared by the enrichment stages.
// Deliberately tiny and dependency-free so they stay portable.

import { ENRICH_RETRY } from './config';
import type { EnrichLogger } from './types';

// Run `fn` with an AbortController that aborts after `ms`. The fn receives the
// signal so it can wire it into fetch/SDK calls. Throws on timeout.
export async function withTimeout<T>(
  ms: number,
  fn: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fn(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Retry with capped exponential backoff. `isTransient` decides whether a thrown
// error is worth retrying (rate limits, 5xx, timeouts) vs. a hard failure. The
// caller varies backoff deterministically — no jitter so tests stay stable.
export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  opts: {
    attempts?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    isTransient?: (err: unknown) => boolean;
    onRetry?: (err: unknown, attempt: number) => void;
  } = {},
): Promise<T> {
  const attempts = opts.attempts ?? ENRICH_RETRY.attempts;
  const baseDelayMs = opts.baseDelayMs ?? ENRICH_RETRY.baseDelayMs;
  const maxDelayMs = opts.maxDelayMs ?? ENRICH_RETRY.maxDelayMs;
  const isTransient = opts.isTransient ?? (() => true);

  let lastErr: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastErr = err;
      if (attempt >= attempts || !isTransient(err)) break;
      opts.onRetry?.(err, attempt);
      const delay = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
      await sleep(delay);
    }
  }
  throw lastErr;
}

// Map over `items` with at most `limit` running at once, preserving order. Unlike
// Promise.all this caps the per-candidate fan-out. Rejections propagate
// — callers that need partial-failure tolerance pass a fn that never throws.
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workerCount = Math.max(1, Math.min(limit, items.length));
  const workers = Array.from({ length: workerCount }, async () => {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await fn(items[index]!, index);
    }
  });
  await Promise.all(workers);
  return results;
}

// A minimal console-backed structured logger. apps can inject their own EnrichLogger.
export function createConsoleLogger(bindings: Record<string, unknown> = {}): EnrichLogger {
  const emit =
    (level: 'info' | 'warn' | 'error') =>
    (message: string, data?: Record<string, unknown>): void => {
      const payload = { level, message, ...bindings, ...data };
      // eslint-disable-next-line no-console
      (level === 'error' ? console.error : level === 'warn' ? console.warn : console.info)(
        JSON.stringify(payload),
      );
    };
  return {
    child: (extra) => createConsoleLogger({ ...bindings, ...extra }),
    info: emit('info'),
    warn: emit('warn'),
    error: emit('error'),
  };
}
