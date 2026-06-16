import { describe, expect, it, vi } from 'vitest';
import { createInMemoryCache } from './cache';
import { enrichLead } from './orchestrator';
import { failingProvider, fakeClient, okProvider, silentLogger } from './test-helpers';
import type { EnrichmentDeps, SearchProvider } from './types';

// Two providers yielding two distinct same-name people in the evidence.
function providers(): SearchProvider[] {
  return [
    okProvider('serpapi', {
      results: [
        { title: 'Jane Doe — VP Sales at Acme', url: 'https://acme.com/jane', snippet: null },
        { title: 'Jane Doe RN — Meridian Health', url: 'https://meridian.com/jane', snippet: null },
      ],
    }),
    okProvider('perplexity', { answer: 'There are two people named Jane Doe.' }),
  ];
}

// Resolves the evidence into two candidates, then structures each from its label.
function client(opts: { failMeridian?: boolean } = {}) {
  return fakeClient((tool, userMessage) => {
    if (tool === 'emit_enrichment_resolution') {
      return {
        candidates: [
          {
            label: 'Jane Doe — VP Sales, Acme',
            confidence: 90,
            reasoning: 'r',
            sourceIndices: [0],
          },
          { label: 'Jane Doe RN — Meridian', confidence: 70, reasoning: 'r', sourceIndices: [1] },
        ],
        rejectedIndices: [],
      };
    }
    // structure call — branch on the candidate in the user message
    if (userMessage.includes('Meridian')) {
      if (opts.failMeridian) throw new Error('structure failed for Meridian');
      return {
        firstName: 'Jane',
        lastName: 'Doe',
        title: 'RN',
        company: 'Meridian Health',
        email: null,
        linkedin: null,
        website: null,
        summary: 'Nurse at Meridian.',
      };
    }
    return {
      firstName: 'Jane',
      lastName: 'Doe',
      title: 'VP Sales',
      company: 'Acme',
      email: null,
      linkedin: null,
      website: null,
      summary: 'VP Sales at Acme.',
    };
  });
}

function deps(over: Partial<EnrichmentDeps> = {}): EnrichmentDeps {
  return {
    client: client(),
    providers: providers(),
    cache: createInMemoryCache(),
    logger: silentLogger,
    ...over,
  };
}

describe('enrichLead', () => {
  it('returns ranked candidates with backfilled entry seeds', async () => {
    const result = await enrichLead(deps(), { source: 'email', value: 'jane.doe@acme.com' });

    expect(result.candidates.map((c) => c.confidence)).toEqual([90, 70]);
    expect(result.candidates.map((c) => c.confidenceTier)).toEqual(['strong', 'good']);

    const top = result.candidates[0]!;
    expect(top.fields.company).toBe('Acme');
    // entry email + derived website backfilled where structure returned null
    expect(top.fields.email).toBe('jane.doe@acme.com');
    expect(top.fields.website).toBe('https://acme.com');
    expect(top.sources.map((s) => s.url)).toEqual(['https://acme.com/jane']);
    expect(result.providers.map((p) => p.ok)).toEqual([true, true]);
  });

  it('tolerates a per-candidate structure failure (one down ≠ all down)', async () => {
    const result = await enrichLead(deps({ client: client({ failMeridian: true }) }), {
      source: 'email',
      value: 'jane.doe@acme.com',
    });
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]!.fields.company).toBe('Acme');
  });

  it('throws when every search provider fails', async () => {
    await expect(
      enrichLead(deps({ providers: [failingProvider('serpapi'), failingProvider('perplexity')] }), {
        source: 'email',
        value: 'jane.doe@acme.com',
      }),
    ).rejects.toThrow('all search providers failed');
  });

  it('serves a cached result on the second identical call', async () => {
    const search = vi.fn(
      okProvider('serpapi', {
        results: [{ title: 'Jane Doe — Acme', url: 'https://acme.com/jane', snippet: null }],
      }).search,
    );
    const countingProvider: SearchProvider = { name: 'serpapi', search };
    const shared = deps({ providers: [countingProvider] });

    await enrichLead(shared, { source: 'email', value: 'jane.doe@acme.com' });
    await enrichLead(shared, { source: 'email', value: 'jane.doe@acme.com' });

    expect(search).toHaveBeenCalledTimes(1); // second call hit the cache
  });
});
