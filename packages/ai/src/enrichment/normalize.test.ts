import { describe, expect, it } from 'vitest';
import { buildSearchQuery, cacheKeyFor, normalizeIdentitySignal, scrubField } from './normalize';

describe('scrubField', () => {
  it('drops sentinel / placeholder values', () => {
    for (const sentinel of ['unknown', 'None', 'N/A', 'n/a', '  ', '', 'null']) {
      expect(scrubField(sentinel)).toBeNull();
    }
  });
  it('keeps and trims real values', () => {
    expect(scrubField('  Acme Corp ')).toBe('Acme Corp');
  });
});

describe('normalizeIdentitySignal — email', () => {
  it('derives company from the domain and a name from the local-part', () => {
    const s = normalizeIdentitySignal('email', 'jane.doe@acme.com', 'US');
    expect(s.email).toBe('jane.doe@acme.com');
    expect(s.name).toBe('Jane Doe');
    expect(s.company).toBe('Acme');
    expect(s.country).toBe('US');
    expect(s.linkedinUrl).toBeNull();
  });

  it('does not fabricate a company from a freemail domain', () => {
    const s = normalizeIdentitySignal('email', 'jane.doe@gmail.com');
    expect(s.company).toBeNull();
    expect(s.name).toBe('Jane Doe');
  });

  it('handles two-level TLDs', () => {
    const s = normalizeIdentitySignal('email', 'sam@getacme.co.uk');
    expect(s.company).toBe('Getacme');
  });
});

describe('normalizeIdentitySignal — linkedin', () => {
  it('parses the slug into a name and normalizes the URL', () => {
    const s = normalizeIdentitySignal('linkedin', 'linkedin.com/in/jane-doe-8a3b21');
    expect(s.linkedinUrl).toBe('https://linkedin.com/in/jane-doe-8a3b21');
    expect(s.name).toBe('Jane Doe'); // digits/hash fragment dropped
    expect(s.email).toBeNull();
  });
});

describe('buildSearchQuery', () => {
  it('joins surviving fields in order and appends the strong identifier', () => {
    const s = normalizeIdentitySignal('email', 'jane.doe@acme.com', 'US');
    const q = buildSearchQuery(s, 'email');
    expect(q.text).toBe('Jane Doe Acme US jane.doe@acme.com');
    expect(q.locale.gl).toBe('us');
  });

  it('uses a per-request locale derived from country, not a hardcoded region', () => {
    const s = normalizeIdentitySignal('linkedin', 'https://linkedin.com/in/jane', 'GB');
    const q = buildSearchQuery(s, 'linkedin');
    expect(q.locale.googleDomain).toBe('google.co.uk');
    expect(q.locale.gl).toBe('uk');
  });

  it('falls back to the raw identifier when no structured field survives', () => {
    const s = normalizeIdentitySignal('linkedin', 'https://linkedin.com/company/acme');
    const q = buildSearchQuery(s, 'linkedin');
    // company URL has no /in/ slug → no name; query is just the URL.
    expect(q.text).toBe('https://linkedin.com/company/acme');
  });
});

describe('cacheKeyFor', () => {
  it('normalizes case + whitespace so trivial differences share a key', () => {
    const a = buildSearchQuery(
      normalizeIdentitySignal('email', 'Jane.Doe@acme.com', 'US'),
      'email',
    );
    const b = buildSearchQuery(
      normalizeIdentitySignal('email', 'jane.doe@acme.com', 'US'),
      'email',
    );
    expect(cacheKeyFor('email', a)).toBe(cacheKeyFor('email', b));
  });
});
