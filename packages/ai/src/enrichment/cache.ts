// Default in-memory TTL cache for enrichment results (two reps
// enriching the same person shouldn't both pay full API cost). Any backend can
// implement EnrichmentCache; this is the zero-config default.

import type { EnrichmentResult } from '@pg/shared';
import { ENRICH_CACHE_TTL_MS } from './config';
import type { EnrichmentCache } from './types';

interface Entry {
  value: EnrichmentResult;
  expiresAt: number;
}

export function createInMemoryCache(ttlMs: number = ENRICH_CACHE_TTL_MS): EnrichmentCache {
  const store = new Map<string, Entry>();
  return {
    get(key) {
      const hit = store.get(key);
      if (!hit) return undefined;
      if (hit.expiresAt <= Date.now()) {
        store.delete(key);
        return undefined;
      }
      return hit.value;
    },
    set(key, value) {
      store.set(key, { value, expiresAt: Date.now() + ttlMs });
    },
  };
}
