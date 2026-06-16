// SerpAPI (Google) search provider. Returns raw organic results + images — the
// complementary evidence shape to Perplexity's synthesized answer.
//
// Locale (google_domain / gl / hl) is taken PER REQUEST from the query, never
// hardcoded — the single most important correctness fix from the old pipeline,
// which baked in a Pakistan locale.

import { extractImageUrls } from '../images';
import type { ProviderResult, ProviderTextResult, SearchProvider, SearchQuery } from '../types';
import { asString, fetchJson } from './http';

const SERPAPI_URL = 'https://serpapi.com/search.json';

interface SerpApiOptions {
  endpoint?: string;
}

function parseOrganic(json: Record<string, unknown>): ProviderTextResult[] {
  const organic = json.organic_results;
  if (!Array.isArray(organic)) return [];
  const out: ProviderTextResult[] = [];
  for (const r of organic) {
    if (!r || typeof r !== 'object') continue;
    const row = r as Record<string, unknown>;
    const url = asString(row.link);
    if (!url) continue;
    out.push({
      title: asString(row.title) ?? url,
      url,
      snippet: asString(row.snippet),
    });
  }
  return out;
}

export function createSerpApiProvider(apiKey: string, opts: SerpApiOptions = {}): SearchProvider {
  const endpoint = opts.endpoint ?? SERPAPI_URL;
  return {
    name: 'serpapi',
    async search(query: SearchQuery, signal: AbortSignal): Promise<ProviderResult> {
      const params = new URLSearchParams({
        engine: 'google',
        q: query.text,
        api_key: apiKey,
        google_domain: query.locale.googleDomain,
        gl: query.locale.gl,
        hl: query.locale.hl,
        num: '10',
      });
      const json = (await fetchJson(
        `${endpoint}?${params.toString()}`,
        { method: 'GET' },
        signal,
      )) as Record<string, unknown>;

      return {
        name: 'serpapi',
        ok: true,
        error: null,
        answer: null,
        results: parseOrganic(json),
        // Images come from inline_images / thumbnails scattered through the payload.
        images: extractImageUrls(json),
      };
    },
  };
}
