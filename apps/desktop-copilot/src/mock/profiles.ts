import type { DiscProfile, OceanProfile } from '@pg/shared';

// Seeded profiles for the overlay demo. In the real product the seller profile
// is scored at onboarding (§4.3) and the buyer profile is built live from the
// buyer's speech (§6.2); here they're canned so the reveal panels (§5.4) have
// something to show. Reuses the @pg/shared DISC/OCEAN shapes for consistency.

export interface DemoProfile {
  disc: DiscProfile;
  ocean: OceanProfile;
  summary: string;
}

// Seller — the analytical/C read the §4.3 onboarding answers would produce.
export const sellerProfile: DemoProfile = {
  disc: { d: 35, i: 30, s: 45, c: 80, primaryType: 'C' },
  ocean: { o: 45, c: 78, e: 40, a: 55, n: 38 },
  summary: 'You sell like a C — analytical and evidence-led. Cues come concise and data-first.',
};

// Buyer — the read the discovery cues converge on (consensus-driven, risk-aware).
// The panel reveals it progressively as discovery completes ("watch it learn").
// The matched technique + its rationale are now derived live (the rules matcher →
// `technique_update`), not canned here.
export const buyerProfile: DemoProfile = {
  disc: { d: 40, i: 35, s: 70, c: 65, primaryType: 'S' },
  ocean: { o: 50, c: 68, e: 45, a: 72, n: 58 },
  summary: 'Consensus-driven and risk-aware — values proof and a low-pressure pace.',
};
