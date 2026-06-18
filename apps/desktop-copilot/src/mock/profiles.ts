import type { DiscProfile, OceanProfile } from '@pg/shared';

// Seeded buyer profile for the overlay demo. In the real product the buyer
// profile is built live from the buyer's speech (§6.2); here it's canned so the
// reveal panels (§5.4) have something to show. Reuses the @pg/shared DISC/OCEAN
// shapes for consistency. (Seller profiling was cut — Russell, 2026-06-15 —
// product intelligence is buyer-only.)

export interface DemoProfile {
  disc: DiscProfile;
  ocean: OceanProfile;
  summary: string;
}

// Buyer — the read the discovery cues converge on (consensus-driven, risk-aware).
// The panel reveals it progressively as discovery completes ("watch it learn").
// The matched technique + its rationale are now derived live (the rules matcher →
// `technique_update`), not canned here.
export const buyerProfile: DemoProfile = {
  disc: { d: 40, i: 35, s: 70, c: 65, primaryType: 'S' },
  ocean: { o: 50, c: 68, e: 45, a: 72, n: 58 },
  summary: 'Consensus-driven and risk-aware — values proof and a low-pressure pace.',
};
