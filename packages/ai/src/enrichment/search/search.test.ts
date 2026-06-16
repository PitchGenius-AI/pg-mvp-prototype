import { describe, expect, it } from 'vitest';
import { failingProvider, okProvider, silentLogger } from '../test-helpers';
import type { SearchQuery } from '../types';
import { runSearch } from './index';

const QUERY: SearchQuery = {
  text: 'Jane Doe Acme',
  locale: { googleDomain: 'google.com', gl: 'us', hl: 'en' },
  signal: {
    name: 'Jane Doe',
    role: null,
    company: 'Acme',
    city: null,
    country: null,
    email: null,
    linkedinUrl: null,
  },
};

describe('runSearch fan-out', () => {
  it('merges + dedupes results across providers and ranks images', async () => {
    const a = okProvider('perplexity', {
      answer: 'Jane is VP Sales at Acme.',
      results: [{ title: 'A', url: 'https://acme.com/jane', snippet: null }],
      images: ['https://example.com/x.png'],
    });
    const b = okProvider('serpapi', {
      results: [
        { title: 'A-dup', url: 'https://acme.com/jane', snippet: 'dup url' }, // same url → deduped
        { title: 'B', url: 'https://news.com/jane', snippet: null },
      ],
      images: ['https://media.licdn.com/img/1'],
    });
    const merged = await runSearch([a, b], QUERY, silentLogger);

    expect(merged.atLeastOneSucceeded).toBe(true);
    expect(merged.textResults.map((r) => r.url)).toEqual([
      'https://acme.com/jane',
      'https://news.com/jane',
    ]);
    expect(merged.answers).toEqual(['Jane is VP Sales at Acme.']);
    // licdn ranks above a generic .png host.
    expect(merged.images[0]).toBe('https://media.licdn.com/img/1');
  });

  it('degrades when one provider fails — continue if ≥1 succeeds', async () => {
    const merged = await runSearch(
      [
        okProvider('serpapi', { results: [{ title: 'B', url: 'https://x.com', snippet: null }] }),
        failingProvider('perplexity'),
      ],
      QUERY,
      silentLogger,
    );
    expect(merged.atLeastOneSucceeded).toBe(true);
    expect(merged.textResults).toHaveLength(1);
    expect(merged.providers.find((p) => p.name === 'perplexity')?.ok).toBe(false);
  });

  it('reports total failure when every provider fails', async () => {
    const merged = await runSearch(
      [failingProvider('serpapi'), failingProvider('perplexity')],
      QUERY,
      silentLogger,
    );
    expect(merged.atLeastOneSucceeded).toBe(false);
    expect(merged.textResults).toHaveLength(0);
  });

  it('throws when no providers are configured', async () => {
    await expect(runSearch([], QUERY, silentLogger)).rejects.toThrow('no search providers');
  });
});
