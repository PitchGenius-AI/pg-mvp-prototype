// Enrichment orchestrator — wires Stage 0→3 into the public EnrichmentResult.
// Cross-cutting concerns live here: result caching, correlation-id logging, and
// partial-failure tolerance on the per-candidate Structure fan-out.

import {
  enrichConfidenceTier,
  enrichmentResultSchema,
  type EnrichmentCandidate,
  type EnrichmentRequest,
  type EnrichmentResult,
  type EnrichSourceCitation,
} from '@pg/shared';
import { createInMemoryCache } from './cache';
import { ENRICH_STRUCTURE_CONCURRENCY } from './config';
import { buildSearchQuery, cacheKeyFor, normalizeIdentitySignal } from './normalize';
import { resolveCandidates, type ResolvedCandidate } from './resolve';
import { runSearch } from './search';
import { structureCandidate, type StructuredProfile } from './structure';
import type { EnrichmentCache, EnrichmentDeps, ProviderTextResult, SearchQuery } from './types';
import { createConsoleLogger, mapWithConcurrency } from './util';

// Module-level default cache so repeat lookups across requests share warmth, while
// still being overridable per-call (and side-effect-free at import).
let sharedCache: EnrichmentCache | null = null;
function defaultCache(): EnrichmentCache {
  if (!sharedCache) sharedCache = createInMemoryCache();
  return sharedCache;
}

function newCorrelationId(): string {
  return `enr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function toCitations(sources: ProviderTextResult[]): EnrichSourceCitation[] {
  return sources.map((s) => ({ title: s.title, url: s.url, snippet: s.snippet }));
}

// Backfill the entry identifier the rep typed (email / LinkedIn URL) when the
// grounded profile didn't surface it, and derive a website from the email domain
// as a last resort. Evidence always wins over these seeds.
function applyEntrySeeds(
  profile: StructuredProfile,
  query: SearchQuery,
): StructuredProfile['fields'] {
  const f = { ...profile.fields };
  const { email, linkedinUrl, company } = query.signal;
  if (!f.email && email) f.email = email;
  if (!f.linkedin && linkedinUrl) f.linkedin = linkedinUrl;
  if (!f.company && company) f.company = company;
  if (!f.website && email) {
    const at = email.lastIndexOf('@');
    const host = at >= 0 ? email.slice(at + 1).trim() : '';
    if (host) f.website = `https://${host}`;
  }
  return f;
}

export async function enrichLead(
  deps: EnrichmentDeps,
  request: EnrichmentRequest,
): Promise<EnrichmentResult> {
  const correlationId = deps.correlationId ?? newCorrelationId();
  const logger = (deps.logger ?? createConsoleLogger()).child({
    correlationId,
    source: request.source,
  });
  const cache = deps.cache ?? defaultCache();

  // Stage 0 — normalize.
  const country = request.country ?? deps.defaultCountry ?? null;
  const signal = normalizeIdentitySignal(request.source, request.value, country);
  const query = buildSearchQuery(signal, request.source);

  const cacheKey = cacheKeyFor(request.source, query);
  const cached = cache.get(cacheKey);
  if (cached) {
    logger.info('enrichment cache hit', { cacheKey });
    return cached;
  }

  logger.info('enrichment start', { query: query.text, locale: query.locale.gl });

  // Stage 1 — search fan-out.
  const evidence = await runSearch(deps.providers, query, logger);
  if (!evidence.atLeastOneSucceeded) {
    // Every provider failed — infrastructure failure, not a genuine miss.
    throw new Error('all search providers failed');
  }

  // Stage 2 — resolve into distinct candidates.
  const resolved: ResolvedCandidate[] = await resolveCandidates(deps.client, evidence, query);
  logger.info('resolve complete', { candidates: resolved.length });

  // Stage 3 — structure each candidate, parallel + concurrency-capped + partial-
  // failure-tolerant (one candidate's failure must not sink the others).
  const structured = await mapWithConcurrency(
    resolved,
    ENRICH_STRUCTURE_CONCURRENCY,
    async (candidate, index): Promise<EnrichmentCandidate | null> => {
      try {
        const profile = await structureCandidate(deps.client, candidate, query);
        const fields = applyEntrySeeds(profile, query);
        return {
          id: `cand_${index}`,
          label: candidate.label,
          confidence: candidate.confidence,
          confidenceTier: enrichConfidenceTier(candidate.confidence),
          reasoning: candidate.reasoning,
          fields,
          summary: profile.summary,
          // Attach the single best image to the top candidate only — image→person
          // attribution isn't reliable enough to spread across candidates.
          imageUrl: index === 0 ? (evidence.images[0] ?? null) : null,
          sources: toCitations(candidate.sources),
        };
      } catch (err) {
        logger.error('structure candidate failed', {
          candidate: candidate.label,
          error: err instanceof Error ? err.message : String(err),
        });
        return null;
      }
    },
  );

  const candidates = structured.filter((c): c is EnrichmentCandidate => c !== null);

  const result = enrichmentResultSchema.parse({
    source: request.source,
    query: query.text,
    candidates,
    providers: evidence.providers.map((p) => ({ name: p.name, ok: p.ok })),
  });

  cache.set(cacheKey, result);
  logger.info('enrichment complete', { candidates: candidates.length });
  return result;
}
