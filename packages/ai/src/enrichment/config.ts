// Centralized enrichment tunables. None of these may be hardcoded
// inside a stage — locale, temperatures, timeouts, retries, concurrency, and the
// image allowlist all live here so they can be tuned without touching chain logic.

import type { SearchLocale } from './types';

// Per-stage sampling temperature. Resolve is a classification/judgment task → low
// and near-deterministic; Structure writes a short grounded summary → slightly
// higher, but the facts still come only from provided sources.
export const ENRICH_TEMPS = {
  resolve: 0.1,
  structure: 0.2,
} as const;

// Network resilience. Every external call gets a timeout; transient
// failures retry with capped exponential backoff.
export const ENRICH_TIMEOUTS_MS = {
  search: 10_000,
  // The image HEAD validation check — cheap, should fail fast.
  imageCheck: 5_000,
} as const;

export const ENRICH_RETRY = {
  attempts: 3,
  baseDelayMs: 400,
  maxDelayMs: 4_000,
} as const;

// Cap the per-candidate Structure fan-out so a noisy query (many same-name people)
// can't open unbounded concurrent LLM calls.
export const ENRICH_STRUCTURE_CONCURRENCY = 4;

// How long a cached enrichment result stays warm. Two reps enriching the same
// person shouldn't both pay full API cost.
export const ENRICH_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// The SINGLE image allowlist (the old code had two divergent
// lists). Used by both the extension check and the CDN-host check; defined once.
export const IMAGE_ALLOWED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp'] as const;

export const IMAGE_ALLOWED_HOSTS = [
  'licdn.com', // LinkedIn
  'gstatic.com',
  'googleusercontent.com',
  'gravatar.com',
  'twimg.com', // Twitter/X
  'wikimedia.org',
  'wikipedia.org',
] as const;

// Per-request search locale (the #1 correctness bug to NOT reproduce
// was a hardcoded Pakistan locale). Derived from the lead's country; falls back to
// a neutral US/English default only when no country is known.
const DEFAULT_LOCALE: SearchLocale = {
  googleDomain: 'google.com',
  gl: 'us',
  hl: 'en',
};

// A small, intentionally non-exhaustive map of country → search locale. Unknown
// countries degrade to the neutral default rather than a region-biased index.
const COUNTRY_LOCALES: Record<string, SearchLocale> = {
  us: { googleDomain: 'google.com', gl: 'us', hl: 'en' },
  gb: { googleDomain: 'google.co.uk', gl: 'uk', hl: 'en' },
  uk: { googleDomain: 'google.co.uk', gl: 'uk', hl: 'en' },
  ca: { googleDomain: 'google.ca', gl: 'ca', hl: 'en' },
  au: { googleDomain: 'google.com.au', gl: 'au', hl: 'en' },
  de: { googleDomain: 'google.de', gl: 'de', hl: 'de' },
  fr: { googleDomain: 'google.fr', gl: 'fr', hl: 'fr' },
  es: { googleDomain: 'google.es', gl: 'es', hl: 'es' },
  nl: { googleDomain: 'google.nl', gl: 'nl', hl: 'nl' },
  in: { googleDomain: 'google.co.in', gl: 'in', hl: 'en' },
  br: { googleDomain: 'google.com.br', gl: 'br', hl: 'pt' },
};

// country may be a 2-letter code or a full name; we only key on a lowercased
// 2-letter prefix match, otherwise the neutral default.
export function localeForCountry(country: string | null | undefined): SearchLocale {
  if (!country) return DEFAULT_LOCALE;
  const key = country.trim().toLowerCase();
  return COUNTRY_LOCALES[key] ?? COUNTRY_LOCALES[key.slice(0, 2)] ?? DEFAULT_LOCALE;
}
