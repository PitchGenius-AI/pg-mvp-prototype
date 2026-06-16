// Perplexity search provider. Returns an LLM-synthesized answer plus citation
// search_results — a different shape of evidence from SerpAPI's raw organic list,
// which is exactly the redundancy the multi-provider fan-out is for.
//
// The API key is injected (never read from process.env here — package boundary).

import { extractImageUrls } from '../images';
import type { ProviderResult, ProviderTextResult, SearchProvider, SearchQuery } from '../types';
import { asString, fetchJson } from './http';

const PERPLEXITY_URL = 'https://api.perplexity.ai/chat/completions';
const DEFAULT_MODEL = 'sonar';

interface PerplexityOptions {
  model?: string;
  endpoint?: string;
}

// Pull {title,url,snippet} out of the (variably-named) citation array Perplexity
// returns. Newer responses use `search_results`; older ones use `citations`
// (bare URLs). Handle both defensively.
function parseResults(json: Record<string, unknown>): ProviderTextResult[] {
  const out: ProviderTextResult[] = [];
  const searchResults = json.search_results;
  if (Array.isArray(searchResults)) {
    for (const r of searchResults) {
      if (!r || typeof r !== 'object') continue;
      const row = r as Record<string, unknown>;
      const url = asString(row.url);
      if (!url) continue;
      out.push({
        title: asString(row.title) ?? url,
        url,
        snippet: asString(row.snippet) ?? asString(row.date) ?? null,
      });
    }
  }
  if (out.length === 0 && Array.isArray(json.citations)) {
    for (const c of json.citations) {
      const url = asString(c);
      if (url) out.push({ title: url, url, snippet: null });
    }
  }
  return out;
}

export function createPerplexityProvider(
  apiKey: string,
  opts: PerplexityOptions = {},
): SearchProvider {
  const model = opts.model ?? DEFAULT_MODEL;
  const endpoint = opts.endpoint ?? PERPLEXITY_URL;
  return {
    name: 'perplexity',
    async search(query: SearchQuery, signal: AbortSignal): Promise<ProviderResult> {
      const prompt =
        `Find the professional identity of this person and the companies/roles ` +
        `associated with them. Return concise factual findings with sources. ` +
        `Query: ${query.text}`;
      const json = (await fetchJson(
        endpoint,
        {
          method: 'POST',
          headers: {
            authorization: `Bearer ${apiKey}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: 'system',
                content:
                  'You are a precise research assistant. Report only what the sources support; never invent people or employers.',
              },
              { role: 'user', content: prompt },
            ],
          }),
        },
        signal,
      )) as Record<string, unknown>;

      const choices = Array.isArray(json.choices) ? json.choices : [];
      const first = choices[0] as Record<string, unknown> | undefined;
      const message = first?.message as Record<string, unknown> | undefined;
      const answer = asString(message?.content);

      return {
        name: 'perplexity',
        ok: true,
        error: null,
        answer,
        results: parseResults(json),
        images: extractImageUrls(json),
      };
    },
  };
}
