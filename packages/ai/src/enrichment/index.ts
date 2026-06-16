// Public surface of the lead-enrichment pipeline (PG-288). apps/api constructs the
// search providers (with injected API keys) and calls enrichLead; the stages and
// utils are exported for testing and for the future bulk-CSV path (Increment 2).

export { enrichLead } from './orchestrator';
export { createInMemoryCache } from './cache';
export { createConsoleLogger } from './util';
export { createPerplexityProvider, createSerpApiProvider, runSearch } from './search';
export { normalizeIdentitySignal, buildSearchQuery, scrubField, cacheKeyFor } from './normalize';
export { resolveCandidates } from './resolve';
export { structureCandidate } from './structure';
export { localeForCountry } from './config';
export { isValidImageUrl, rankImages, extractImageUrls } from './images';
export type {
  EnrichmentDeps,
  EnrichmentCache,
  EnrichLogger,
  SearchProvider,
  SearchQuery,
  SearchLocale,
  IdentitySignal,
  ProviderResult,
  ProviderTextResult,
  MergedEvidence,
} from './types';
export type { ResolvedCandidate } from './resolve';
export type { StructuredProfile } from './structure';
