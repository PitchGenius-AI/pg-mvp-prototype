import { createPerplexityProvider, createSerpApiProvider, type SearchProvider } from '@pg/ai';
import { env } from './env';

// The configured lead-enrichment search providers (PG-288), built once from env
// keys. Degrades gracefully: whichever provider has a key is included. The
// enrichment router refuses the call when the list is empty. Building these config
// objects is side-effect-free — no network until a search actually runs.
export const enrichmentProviders: SearchProvider[] = [
  env.PERPLEXITY_API_KEY ? createPerplexityProvider(env.PERPLEXITY_API_KEY) : null,
  env.SERPAPI_KEY ? createSerpApiProvider(env.SERPAPI_KEY) : null,
].filter((p): p is SearchProvider => p !== null);
