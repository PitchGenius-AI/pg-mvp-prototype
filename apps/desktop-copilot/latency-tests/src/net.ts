import { PING_ENDPOINT } from './config';
import type { NetworkSample } from './types';

// A cheap round-trip sample to a known host at run start, so each results file
// carries the network conditions it was captured under. Not a substitute for a
// real network profile — just a sanity signal alongside machine_id.
export async function pingEndpoint(endpoint: string = PING_ENDPOINT): Promise<NetworkSample> {
  for (const method of ['HEAD', 'GET'] as const) {
    const start = performance.now();
    try {
      await fetch(endpoint, { method, signal: AbortSignal.timeout(5000) });
      return { endpoint, pingMs: Math.round((performance.now() - start) * 10) / 10 };
    } catch {
      // Try the next method; some hosts reject HEAD.
    }
  }
  return { endpoint, pingMs: null };
}
