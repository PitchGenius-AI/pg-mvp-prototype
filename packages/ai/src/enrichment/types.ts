// Internal data contracts between enrichment stages. The public output contract
// (EnrichmentResult, EnrichmentCandidate, …) lives in @pg/shared; these are the
// in-pipeline shapes the stages pass to each other (clean per-stage
// contracts so stages stay portable, pure transforms).

import type { AnthropicClient } from '../client';

// ── Stage 0 output ──────────────────────────────────────────────────────────

// A normalized person identity signal. `name` is the only field the pipeline
// hard-requires; everything else sharpens the search.
export interface IdentitySignal {
  name: string | null;
  role: string | null;
  company: string | null;
  city: string | null;
  country: string | null;
  email: string | null;
  linkedinUrl: string | null;
}

export interface SearchLocale {
  googleDomain: string; // e.g. 'google.com'
  gl: string; // geo country code, e.g. 'us'
  hl: string; // host language, e.g. 'en'
}

export interface SearchQuery {
  // The joined query string sent to providers (name → role → company → location).
  text: string;
  locale: SearchLocale;
  // The signal is carried forward so Resolve has the original intent to match on.
  signal: IdentitySignal;
}

// ── Stage 1 (search) contracts ───────────────────────────────────────────────

export interface ProviderTextResult {
  title: string;
  url: string;
  snippet: string | null;
}

// One provider's response, defensively normalized. A provider that throws/times
// out still returns this shape with ok=false so the fan-out can degrade, not fail
//.
export interface ProviderResult {
  name: string;
  ok: boolean;
  error: string | null;
  // LLM-synthesized answer (e.g. Perplexity); null for raw-results providers.
  answer: string | null;
  results: ProviderTextResult[];
  // Raw, unvalidated image URLs; validation/ranking happens in images.ts.
  images: string[];
}

// A single search provider. Implementations own their own request shaping but must
// honor the passed AbortSignal (timeout) and never throw — they resolve to a
// ok=false ProviderResult on failure.
export interface SearchProvider {
  name: string;
  search(query: SearchQuery, signal: AbortSignal): Promise<ProviderResult>;
}

// The merged evidence object handed to Resolve. `atLeastOneSucceeded` gates the
// whole pipeline — false means every provider failed and we stop.
export interface MergedEvidence {
  providers: ProviderResult[];
  atLeastOneSucceeded: boolean;
  // Deduped textual evidence across providers.
  textResults: ProviderTextResult[];
  // Synthesized provider answers, in provider order.
  answers: string[];
  // Validated + quality-ranked profile image URLs.
  images: string[];
}

// ── Cross-cutting: logging + cache ────────────────────────────────

// Structured logger with a correlation id threaded across stages. The default
// impl logs to console; apps can inject their own.
export interface EnrichLogger {
  child(bindings: Record<string, unknown>): EnrichLogger;
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
}

// Result cache keyed on the normalized query. Any backend; the default is an
// in-memory TTL map.
export interface EnrichmentCache {
  get(key: string): import('@pg/shared').EnrichmentResult | undefined;
  set(key: string, value: import('@pg/shared').EnrichmentResult): void;
}

// Everything enrichLead needs, injected by the caller (apps/api). Keys/providers
// are built upstream so @pg/ai never reads process.env (package boundary rule).
export interface EnrichmentDeps {
  client: AnthropicClient;
  providers: SearchProvider[];
  cache?: EnrichmentCache;
  logger?: EnrichLogger;
  // Workspace-level fallback country when the request doesn't carry one.
  defaultCountry?: string | null;
  // Correlation id for this enrichment; generated if omitted.
  correlationId?: string;
}
