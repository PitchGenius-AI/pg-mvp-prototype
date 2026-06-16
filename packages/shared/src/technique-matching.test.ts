import { describe, expect, it } from 'vitest';
import { matchTechnique, techniqueMatchSchema } from './technique-matching';

// Worked examples from the guide (§12) — the §5 formula is operative, so we assert
// what the formula produces (which may refine the guide's illustrative prose).

describe('matchTechnique', () => {
  it('decisive, skeptical, unflappable exec → Challenger, high confidence', () => {
    const m = matchTechnique(
      { d: 85, i: 30, s: 25, c: 60 },
      { o: 70, c: 60, e: 50, a: 25, n: 20 },
    );
    expect(m.primary).toBe('challenger');
    expect(m.confidenceBand).toBe('high');
    expect(m.isHybrid).toBe(false);
    // High D + High C + High O + High Cn + Low N is the guide's Strategic Skeptic pattern.
    expect(m.buyerArchetype).toBe('Strategic Skeptic');
    expect(techniqueMatchSchema.safeParse(m).success).toBe(true);
  });

  it('low-conscientiousness, low-agreeableness driver → Power Buyer', () => {
    const m = matchTechnique(
      { d: 85, i: 45, s: 25, c: 35 },
      { o: 75, c: 35, e: 55, a: 25, n: 30 },
    );
    expect(m.primary).toBe('challenger');
    expect(m.buyerArchetype).toBe('Power Buyer');
  });

  it('careful, analytical, risk-averse buyer → SPIN primary, NEPQ secondary', () => {
    const m = matchTechnique(
      { d: 30, i: 30, s: 75, c: 65 },
      { o: 40, c: 70, e: 40, a: 60, n: 70 },
    );
    expect(m.primary).toBe('spin');
    expect(m.secondary).toBe('nepq');
    expect(m.recommendedOpeningStyle).toBe('Structured, situation-first');
  });

  it('trust-first buyer (high S, high A, mod/high N) → NEPQ', () => {
    const m = matchTechnique(
      { d: 25, i: 40, s: 75, c: 35 },
      { o: 40, c: 35, e: 45, a: 80, n: 60 },
    );
    expect(m.primary).toBe('nepq');
    expect(m.buyerArchetype).toBe('Trust-First Buyer');
  });

  it('clean Strategic Skeptic profile maps to that archetype', () => {
    const m = matchTechnique(
      { d: 85, i: 30, s: 25, c: 70 },
      { o: 80, c: 75, e: 50, a: 30, n: 20 },
    );
    expect(m.primary).toBe('challenger');
    expect(m.buyerArchetype).toBe('Strategic Skeptic');
  });

  it('near-tie (high I + high O) → low confidence triggers a hybrid', () => {
    const m = matchTechnique(
      { d: 50, i: 80, s: 40, c: 45 },
      { o: 80, c: 45, e: 70, a: 60, n: 40 },
    );
    expect(m.confidenceBand).toBe('low');
    expect(m.isHybrid).toBe(true);
    expect(m.hybridStyle).not.toBeNull();
  });

  it('Influence drives NEPQ, not Challenger (the corrected sign)', () => {
    // A high-I, otherwise-neutral buyer should score NEPQ above Challenger.
    const m = matchTechnique(
      { d: 40, i: 90, s: 50, c: 40 },
      { o: 50, c: 45, e: 60, a: 60, n: 45 },
    );
    expect(m.scores.nepq).toBeGreaterThan(m.scores.challenger);
  });

  it('high Agreeableness lifts NEPQ above Challenger (the corrected sign)', () => {
    const m = matchTechnique(
      { d: 40, i: 50, s: 55, c: 45 },
      { o: 45, c: 45, e: 50, a: 90, n: 50 },
    );
    expect(m.scores.nepq).toBeGreaterThan(m.scores.challenger);
  });
});

// Coverage sweep of the guide's §8 archetype table. Representative profile per
// archetype; asserts the OPERATIVE output — the primary technique — matches the
// guide for all 10. (Secondary technique and the archetype *label* can differ on
// close calls between the guide's overlapping patterns; those are intentionally
// not asserted here — see the QA notes on PG-310.)
describe('matchTechnique — guide §8 archetype sweep (primary technique)', () => {
  const cases: Array<{
    label: string;
    disc: { d: number; i: number; s: number; c: number };
    ocean: { o: number; c: number; e: number; a: number; n: number };
    expectPrimary: 'challenger' | 'spin' | 'nepq';
  }> = [
    { label: 'Strategic Skeptic', disc: { d: 85, i: 30, s: 25, c: 75 }, ocean: { o: 80, c: 75, e: 50, a: 30, n: 20 }, expectPrimary: 'challenger' },
    { label: 'Structured Evaluator', disc: { d: 35, i: 30, s: 70, c: 70 }, ocean: { o: 45, c: 70, e: 45, a: 55, n: 50 }, expectPrimary: 'spin' },
    { label: 'Trust-First Buyer', disc: { d: 25, i: 40, s: 75, c: 35 }, ocean: { o: 40, c: 35, e: 45, a: 80, n: 60 }, expectPrimary: 'nepq' },
    { label: 'Relationship Persuader', disc: { d: 40, i: 80, s: 50, c: 40 }, ocean: { o: 55, c: 45, e: 75, a: 75, n: 40 }, expectPrimary: 'nepq' },
    { label: 'Power Buyer', disc: { d: 85, i: 45, s: 25, c: 35 }, ocean: { o: 75, c: 35, e: 55, a: 25, n: 30 }, expectPrimary: 'challenger' },
    { label: 'Risk Controller', disc: { d: 35, i: 25, s: 55, c: 75 }, ocean: { o: 25, c: 75, e: 40, a: 55, n: 50 }, expectPrimary: 'spin' },
    { label: 'Stability Seeker', disc: { d: 25, i: 40, s: 80, c: 40 }, ocean: { o: 25, c: 45, e: 45, a: 75, n: 45 }, expectPrimary: 'nepq' },
    { label: 'Visionary Driver', disc: { d: 80, i: 80, s: 30, c: 45 }, ocean: { o: 80, c: 45, e: 65, a: 50, n: 40 }, expectPrimary: 'challenger' },
    { label: 'Anxious Analyst', disc: { d: 30, i: 30, s: 55, c: 70 }, ocean: { o: 40, c: 75, e: 40, a: 55, n: 75 }, expectPrimary: 'spin' },
    { label: 'Warm Collaborator', disc: { d: 30, i: 75, s: 75, c: 40 }, ocean: { o: 50, c: 45, e: 60, a: 80, n: 45 }, expectPrimary: 'nepq' },
  ];

  it.each(cases)('$label → primary $expectPrimary', ({ disc, ocean, expectPrimary }) => {
    expect(matchTechnique(disc, ocean).primary).toBe(expectPrimary);
  });
});
