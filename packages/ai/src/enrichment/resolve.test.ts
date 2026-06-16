import { describe, expect, it } from 'vitest';
import { resolveCandidates } from './resolve';
import { fakeClient } from './test-helpers';
import type { MergedEvidence, ProviderTextResult, SearchQuery } from './types';

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

function evidence(results: ProviderTextResult[]): MergedEvidence {
  return {
    providers: [{ name: 'serpapi', ok: true, error: null, answer: null, results, images: [] }],
    atLeastOneSucceeded: true,
    textResults: results,
    answers: [],
    images: [],
  };
}

const SOURCES: ProviderTextResult[] = [
  { title: 'Jane Doe — VP Sales at Acme', url: 'https://acme.com/jane', snippet: null },
  { title: 'Jane Doe LinkedIn', url: 'https://linkedin.com/in/jane', snippet: null },
  { title: 'Jane Doe RN — Meridian Health', url: 'https://meridian.com/jane', snippet: null },
];

describe('resolveCandidates', () => {
  it('clusters by index, sorts by confidence, and drops hallucinated indices', async () => {
    const client = fakeClient((tool) => {
      expect(tool).toBe('emit_enrichment_resolution');
      return {
        candidates: [
          // returned out of confidence order on purpose
          {
            label: 'Jane Doe — VP Sales, Acme',
            confidence: 60,
            reasoning: 'r',
            sourceIndices: [0, 1],
          },
          { label: 'Jane Doe RN — Meridian', confidence: 90, reasoning: 'r', sourceIndices: [2] },
          { label: 'Jane Doe — weak', confidence: 40, reasoning: 'r', sourceIndices: [5, 0] },
        ],
        rejectedIndices: [],
      };
    });

    const out = await resolveCandidates(client, evidence(SOURCES), QUERY);

    // sorted desc by confidence
    expect(out.map((c) => c.confidence)).toEqual([90, 60, 40]);
    // index → source mapping
    expect(out[0]!.sources.map((s) => s.url)).toEqual(['https://meridian.com/jane']);
    expect(out[1]!.sources.map((s) => s.url)).toEqual([
      'https://acme.com/jane',
      'https://linkedin.com/in/jane',
    ]);
    // out-of-range index 5 dropped; index 0 kept
    expect(out[2]!.sources.map((s) => s.url)).toEqual(['https://acme.com/jane']);
  });

  it('returns [] without calling the model when there is no evidence', async () => {
    const client = fakeClient(() => {
      throw new Error('model should not be called');
    });
    const out = await resolveCandidates(client, evidence([]), QUERY);
    expect(out).toEqual([]);
  });
});
