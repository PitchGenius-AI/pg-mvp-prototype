// Stage 0 — Input normalization. The ONE front door: every identity
// signal (email, LinkedIn URL, future structured fields) converges here into a
// single IdentitySignal → SearchQuery. The sentinel scrub lives here and nowhere
// else, so no placeholder value ("unknown", "n/a", …) ever reaches a search API.

import type { EnrichSource } from '@pg/shared';
import { localeForCountry } from './config';
import type { IdentitySignal, SearchLocale, SearchQuery } from './types';

// Placeholder/sentinel strings that must never be sent to a provider. Centralized
// here (the old code duplicated this in three places).
const SENTINELS = new Set(['unknown', 'none', 'n/a', 'na', 'null', 'undefined', '']);

export function scrubField(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (trimmed === '' || SENTINELS.has(trimmed.toLowerCase())) return null;
  return trimmed;
}

function titleCase(raw: string): string {
  return raw
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

// Pull a plausible first/last name from an email local-part or LinkedIn slug
// (`jane.doe`, `jane-doe-8a3b21`). Drops digits + hash-like fragments; keeps the
// first two alphabetic tokens. The name is only a seed — search + resolve confirm
// or correct it.
function nameFromTokens(raw: string): string | null {
  const tokens = raw
    .replace(/[0-9]+/g, ' ')
    .split(/[._\-\s]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1 && /^[a-zA-Z]+$/.test(t));
  if (tokens.length === 0) return null;
  return tokens.slice(0, 2).map(titleCase).join(' ');
}

const TWO_LEVEL_TLDS = new Set(['co.uk', 'com.au', 'co.nz', 'co.za', 'com.br']);

// Company name from a host: `acme.com` → `Acme`, `getacme.co.uk` → `Getacme`.
function companyFromHost(host: string): string | null {
  const clean = host.replace(/^www\./i, '').toLowerCase();
  const parts = clean.split('.').filter(Boolean);
  if (parts.length < 2) return null;
  let core = parts;
  if (parts.length >= 3 && TWO_LEVEL_TLDS.has(parts.slice(-2).join('.'))) {
    core = parts.slice(0, -2);
  } else {
    core = parts.slice(0, -1);
  }
  const sld = core[core.length - 1];
  if (!sld) return null;
  // Generic mailbox providers carry no company signal — don't fabricate one.
  if (FREEMAIL_HOSTS.has(clean)) return null;
  return titleCase(sld.replace(/[-_]+/g, ' '));
}

const FREEMAIL_HOSTS = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'icloud.com',
  'proton.me',
  'protonmail.com',
  'aol.com',
]);

function hostFromEmail(email: string): string | null {
  const at = email.lastIndexOf('@');
  if (at < 0) return null;
  const host = email
    .slice(at + 1)
    .trim()
    .toLowerCase();
  return host.length > 0 ? host : null;
}

function linkedinSlug(url: string): string | null {
  const m = url.match(/\/in\/([^/?#]+)/i);
  if (m?.[1]) return decodeURIComponent(m[1]);
  return null;
}

// Turn the entry-point (source + raw value) into a normalized IdentitySignal.
// `defaultCountry` is the workspace fallback used for the search locale.
export function normalizeIdentitySignal(
  source: EnrichSource,
  rawValue: string,
  defaultCountry: string | null = null,
): IdentitySignal {
  const value = rawValue.trim();
  const base: IdentitySignal = {
    name: null,
    role: null,
    company: null,
    city: null,
    country: scrubField(defaultCountry),
    email: null,
    linkedinUrl: null,
  };

  if (source === 'email') {
    const host = hostFromEmail(value);
    const local = host ? value.slice(0, value.lastIndexOf('@')) : value;
    return {
      ...base,
      email: value,
      name: nameFromTokens(local),
      company: host ? companyFromHost(host) : null,
    };
  }

  // linkedin
  const url = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  const slug = linkedinSlug(url);
  return {
    ...base,
    linkedinUrl: url,
    name: slug ? nameFromTokens(slug) : null,
  };
}

// Stage 0 output — build the provider query string from the signal. Surviving
// fields are joined in a stable order (name → role → company → location); the
// strong identifier (email / LinkedIn URL) is appended so providers can pin the
// exact person. Falls back to the raw identifier if nothing else survives.
export function buildSearchQuery(signal: IdentitySignal, source: EnrichSource): SearchQuery {
  const locale: SearchLocale = localeForCountry(signal.country);
  const ordered = [signal.name, signal.role, signal.company, signal.city, signal.country]
    .map(scrubField)
    .filter((v): v is string => v !== null);

  const identifier = source === 'email' ? signal.email : signal.linkedinUrl;
  const terms = [...ordered];
  if (identifier) terms.push(identifier);

  const text = terms.join(' ').trim() || (identifier ?? '');
  return { text, locale, signal };
}

// The cache key for an enrichment — normalized so trivial spacing/case differences
// share a cached result.
export function cacheKeyFor(source: EnrichSource, query: SearchQuery): string {
  return `enrich:${source}:${query.locale.gl}:${query.text.toLowerCase().replace(/\s+/g, ' ')}`;
}
