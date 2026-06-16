// Stage 1 — Search fan-out. Runs all providers CONCURRENTLY, each with
// its own timeout + retry-with-backoff, and merges their evidence. Degrades, never
// fails: the stage only halts the pipeline if EVERY provider failed.

import { ENRICH_TIMEOUTS_MS } from '../config';
import { rankImages } from '../images';
import type {
  EnrichLogger,
  MergedEvidence,
  ProviderResult,
  ProviderTextResult,
  SearchProvider,
  SearchQuery,
} from '../types';
import { withRetry, withTimeout } from '../util';
import { isTransientError } from './http';

export { createPerplexityProvider } from './perplexity';
export { createSerpApiProvider } from './serpapi';

// Run one provider with a fresh timeout per attempt + transient retry. Any final
// failure becomes an ok=false result rather than a throw.
async function runProvider(
  provider: SearchProvider,
  query: SearchQuery,
  logger: EnrichLogger,
): Promise<ProviderResult> {
  try {
    return await withRetry(
      () => withTimeout(ENRICH_TIMEOUTS_MS.search, (signal) => provider.search(query, signal)),
      {
        isTransient: isTransientError,
        onRetry: (err, attempt) =>
          logger.warn('search provider retry', {
            provider: provider.name,
            attempt,
            error: err instanceof Error ? err.message : String(err),
          }),
      },
    );
  } catch (err) {
    logger.error('search provider failed', {
      provider: provider.name,
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      name: provider.name,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      answer: null,
      results: [],
      images: [],
    };
  }
}

// Dedupe textual results by URL, preserving first-seen order across providers.
function mergeTextResults(providers: ProviderResult[]): ProviderTextResult[] {
  const seen = new Set<string>();
  const merged: ProviderTextResult[] = [];
  for (const p of providers) {
    for (const r of p.results) {
      const key = r.url.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(r);
    }
  }
  return merged;
}

export async function runSearch(
  providers: SearchProvider[],
  query: SearchQuery,
  logger: EnrichLogger,
): Promise<MergedEvidence> {
  if (providers.length === 0) {
    throw new Error('no search providers configured');
  }
  const results = await Promise.all(providers.map((p) => runProvider(p, query, logger)));
  const atLeastOneSucceeded = results.some((r) => r.ok);

  const answers = results
    .map((r) => r.answer)
    .filter((a): a is string => a !== null && a.trim() !== '');
  const images = rankImages(results.flatMap((r) => r.images));

  logger.info('search complete', {
    providers: results.map((r) => ({ name: r.name, ok: r.ok, results: r.results.length })),
    atLeastOneSucceeded,
  });

  return {
    providers: results,
    atLeastOneSucceeded,
    textResults: mergeTextResults(results),
    answers,
    images,
  };
}
