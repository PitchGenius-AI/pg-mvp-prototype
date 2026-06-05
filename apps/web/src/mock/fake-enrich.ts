import { mockAiCall } from './mock-api';

// Fake buyer enrichment for the Manual Entry intake method (PG-210, reworked).
// Stands in for the real enrichment chains that would live in packages/ai: a
// domain/website scrape (from an email) and a LinkedIn-profile + company-site
// scrape (from a LinkedIn URL). It returns whatever fields it could derive so
// the form can be pre-filled — fields it can't determine come back null and the
// rep fills them in. All mock-backed — no network.

export type EnrichSource = 'email' | 'linkedin';

// The buyer fields enrichment can populate. Anything it can't determine is null
// (e.g. a domain scrape can't know an individual's title) so the form shows it
// blank with its required marker intact.
export interface BuyerEnrichment {
  firstName: string | null;
  lastName: string | null;
  title: string | null;
  company: string | null;
  email: string | null;
  linkedin: string | null;
  website: string | null;
}

export type EnrichResult =
  | { ok: true; source: EnrichSource; enrichment: BuyerEnrichment }
  | { ok: false; source: EnrichSource; reason: string };

// Staged messages shown during the simulated read, mirroring FAKE_SCRAPE_STEPS.
// Cycled on a timer by the lookup component, independent of the promise.
export const EMAIL_ENRICH_STEPS = [
  'Looking up the email domain…',
  'Reading the company website…',
  'Identifying the company…',
] as const;

export const LINKEDIN_ENRICH_STEPS = [
  'Opening the LinkedIn profile…',
  'Reading their role and company…',
  'Checking the company website…',
] as const;

// Deterministic hook so a demoer can show the manual-entry fallback on demand:
// any email/URL containing `fail` comes back as a miss. Everything else resolves.
function shouldEnrichFail(value: string): boolean {
  return value.toLowerCase().includes('fail');
}

function titleCase(raw: string): string {
  return raw
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

// Pull a plausible first/last name out of an email local-part or LinkedIn slug
// (e.g. `jane.doe`, `jane-doe-8a3b21`). Drops digits and hash-like fragments;
// keeps the first two alphabetic tokens. Returns nulls when nothing usable.
function nameFromTokens(raw: string): { firstName: string | null; lastName: string | null } {
  const tokens = raw
    .replace(/[0-9]+/g, ' ')
    .split(/[._\-\s]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1 && /^[a-zA-Z]+$/.test(t));
  if (tokens.length === 0) return { firstName: null, lastName: null };
  return {
    firstName: titleCase(tokens[0]!),
    lastName: tokens.length > 1 ? titleCase(tokens[1]!) : null,
  };
}

const TWO_LEVEL_TLDS = new Set(['co.uk', 'com.au', 'co.nz', 'co.za', 'com.br']);

// Derive a company name from a host (`acme.com` → `Acme`, `getacme.co.uk` →
// `Getacme`). Strips `www.` and the TLD; handles the common 2-level TLDs.
function companyFromHost(host: string): string {
  const clean = host.replace(/^www\./i, '').toLowerCase();
  const parts = clean.split('.').filter(Boolean);
  let core = parts;
  if (parts.length >= 3 && TWO_LEVEL_TLDS.has(parts.slice(-2).join('.'))) {
    core = parts.slice(0, -2);
  } else if (parts.length >= 2) {
    core = parts.slice(0, -1);
  }
  const sld = core[core.length - 1] ?? clean;
  return titleCase(sld.replace(/[-_]+/g, ' '));
}

function hostFromEmail(email: string): string | null {
  const at = email.lastIndexOf('@');
  if (at < 0) return null;
  const host = email.slice(at + 1).trim().toLowerCase();
  return host.length > 0 ? host : null;
}

function linkedinSlug(url: string): string {
  const m = url.match(/\/in\/([^/?#]+)/i);
  if (m?.[1]) return decodeURIComponent(m[1]);
  const cleaned = url.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  const parts = cleaned.split('/').filter(Boolean);
  return parts[parts.length - 1] ?? cleaned;
}

// FNV-1a so a LinkedIn slug deterministically maps to the same canned company +
// title every time (the slug carries no real company, so we fabricate one).
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const LINKEDIN_COMPANIES = [
  { company: 'Northwind Logistics', website: 'https://northwind.example' },
  { company: 'Cedar & Bloom', website: 'https://cedarbloom.example' },
  { company: 'Meridian Health', website: 'https://meridianhealth.example' },
  { company: 'Atlas Manufacturing', website: 'https://atlasmfg.example' },
  { company: 'Lumen Retail Group', website: 'https://lumenretail.example' },
] as const;

const LINKEDIN_TITLES = [
  'VP of Sales',
  'Director of Operations',
  'Head of Procurement',
  'Chief Revenue Officer',
  'Director of IT',
  'VP of Marketing',
] as const;

// Email enrichment: we can read the company from the domain + its website, and
// take a reasonable guess at the name from the local-part. We can't know the
// person's title from a domain, so it comes back null (blank on the form).
function enrichFromEmail(email: string): BuyerEnrichment {
  const normalized = email.trim();
  const host = hostFromEmail(normalized);
  const local = host ? normalized.slice(0, normalized.lastIndexOf('@')) : normalized;
  const { firstName, lastName } = nameFromTokens(local);
  return {
    firstName,
    lastName,
    title: null,
    company: host ? companyFromHost(host) : null,
    email: normalized,
    linkedin: null,
    website: host ? `https://${host}` : null,
  };
}

// LinkedIn enrichment: the profile gives us the name + role + employer, and the
// employer's site gives us the website. We can't get an email this way, so it
// comes back null.
function enrichFromLinkedin(url: string): BuyerEnrichment {
  const normalized = url.trim();
  const slug = linkedinSlug(normalized);
  const { firstName, lastName } = nameFromTokens(slug);
  const seed = hash(slug);
  const company = LINKEDIN_COMPANIES[seed % LINKEDIN_COMPANIES.length]!;
  const title = LINKEDIN_TITLES[(seed >>> 8) % LINKEDIN_TITLES.length]!;
  return {
    firstName,
    lastName,
    title,
    company: company.company,
    email: null,
    linkedin: normalized,
    website: company.website,
  };
}

export function fakeEnrichBuyer(source: EnrichSource, value: string): Promise<EnrichResult> {
  return mockAiCall<EnrichResult>(() => {
    if (shouldEnrichFail(value)) {
      return {
        ok: false,
        source,
        reason:
          source === 'email'
            ? "We couldn't read enough from that domain to fill anything in."
            : "We couldn't read enough from that profile to fill anything in.",
      };
    }
    return {
      ok: true,
      source,
      enrichment: source === 'email' ? enrichFromEmail(value) : enrichFromLinkedin(value),
    };
  });
}
