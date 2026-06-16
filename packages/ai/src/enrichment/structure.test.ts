import { describe, expect, it } from 'vitest';
import { structureCandidate } from './structure';
import type { ResolvedCandidate } from './resolve';
import { fakeClient } from './test-helpers';
import type { SearchQuery } from './types';

const QUERY: SearchQuery = {
  text: 'Jane Doe',
  locale: { googleDomain: 'google.com', gl: 'us', hl: 'en' },
  signal: {
    name: 'Jane Doe',
    role: null,
    company: null,
    city: null,
    country: null,
    email: null,
    linkedinUrl: null,
  },
};

const CANDIDATE: ResolvedCandidate = {
  label: 'Jane Doe — Acme',
  confidence: 90,
  reasoning: 'r',
  sources: [{ title: 'Acme team', url: 'https://acme.com/jane', snippet: null }],
};

describe('structureCandidate', () => {
  it('scrubs literal "null"/"unknown"/"n/a" strings the model emits into real nulls', async () => {
    const client = fakeClient(() => ({
      firstName: 'Jane',
      lastName: 'null', // model emitted the string, not JSON null
      title: 'Unknown',
      company: 'Acme',
      email: 'N/A',
      linkedin: '',
      website: 'null',
      summary: 'Works at Acme.',
    }));

    const { fields, summary } = await structureCandidate(client, CANDIDATE, QUERY);
    expect(fields.firstName).toBe('Jane');
    expect(fields.company).toBe('Acme');
    expect(fields.lastName).toBeNull();
    expect(fields.title).toBeNull();
    expect(fields.email).toBeNull();
    expect(fields.linkedin).toBeNull();
    expect(fields.website).toBeNull();
    expect(summary).toBe('Works at Acme.');
  });
});
