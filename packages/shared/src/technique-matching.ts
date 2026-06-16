import { z } from 'zod';
import { salesTechniqueSchema, type SalesTechnique } from './enums';

/**
 * Canonical, deterministic sales-technique matching engine.
 *
 * Source of truth: `apps/desktop-copilot/docs/sales-technique-matching.md`, which
 * encodes the client's _PitchGenius AI Sales Technique Matching Roadmap_. The §5
 * scoring formula is OPERATIVE — both the `@pg/ai` pre-call chain and the desktop
 * Rust planner align to this. (PG-310.)
 *
 * Pure: no runtime deps beyond zod (the `@pg/shared` package boundary).
 */

// ── Buyer archetypes (guide §8) ──────────────────────────────────────────────
export const buyerArchetypes = [
  'Strategic Skeptic',
  'Structured Evaluator',
  'Trust-First Buyer',
  'Relationship Persuader',
  'Power Buyer',
  'Risk Controller',
  'Stability Seeker',
  'Visionary Driver',
  'Anxious Analyst',
  'Warm Collaborator',
] as const;
export const buyerArchetypeSchema = z.enum(buyerArchetypes);
export type BuyerArchetype = z.infer<typeof buyerArchetypeSchema>;

// Confidence band from the primary↔secondary gap (guide §6).
export const techniqueConfidenceBands = ['low', 'medium', 'high'] as const;
export const techniqueConfidenceBandSchema = z.enum(techniqueConfidenceBands);
export type TechniqueConfidenceBand = z.infer<typeof techniqueConfidenceBandSchema>;

// ── Output (guide §9 object + the deterministic extras) ───────────────────────
export const techniqueMatchSchema = z.object({
  primary: salesTechniqueSchema,
  secondary: salesTechniqueSchema,
  buyerArchetype: buyerArchetypeSchema,
  /** primary_score − secondary_score, 0–1 (guide §10). */
  confidenceScore: z.number(),
  confidenceBand: techniqueConfidenceBandSchema,
  /** Low confidence ⇒ recommend a hybrid (guide §6/§7). */
  isHybrid: z.boolean(),
  hybridStyle: z.string().nullable(),
  recommendedOpeningStyle: z.string(),
  avoid: z.array(z.string()),
  bestQuestionType: z.string(),
  /** Raw 0–1 technique scores, for transparency / the desktop tier display. */
  scores: z.object({ challenger: z.number(), spin: z.number(), nepq: z.number() }),
});
export type TechniqueMatch = z.infer<typeof techniqueMatchSchema>;

// ── Inputs (0–100 components; mirrors DiscProfile / OceanProfile) ─────────────
export interface DiscScores {
  d: number;
  i: number;
  s: number;
  c: number;
}
export interface OceanScores {
  o: number;
  c: number;
  e: number;
  a: number;
  n: number;
}

// Per-technique copy guidance (guide §10), keyed by the primary technique.
const COPY: Record<SalesTechnique, { openingStyle: string; bestQuestionType: string; avoid: string[] }> = {
  challenger: {
    openingStyle: 'Direct, insight-led, technical',
    bestQuestionType: 'diagnostic challenge question',
    avoid: ['soft rapport-heavy opening', 'generic benefits', 'unsupported claims', '"just checking in" openers'],
  },
  spin: {
    openingStyle: 'Structured, situation-first',
    bestQuestionType: 'situation / problem / implication question',
    avoid: ['aggressive claims', 'abstract vision', 'fast closes', 'overly emotional language'],
  },
  nepq: {
    openingStyle: 'Permission-based, low-pressure',
    bestQuestionType: 'permission-based discovery question',
    avoid: ['hard challenges', 'technical overload', 'pressure closes', 'proving too early'],
  },
};

// Hybrid output styles by ordered (primary, secondary) pair (guide §7). The two
// pairs the guide doesn't name explicitly fall back to the nearest style.
const HYBRID_STYLE: Record<string, string> = {
  'challenger+spin': 'Technical Challenger',
  'spin+challenger': 'Consultative Analyst',
  'nepq+spin': 'Empathetic Diagnostic',
  'nepq+challenger': 'Soft Challenger',
  'challenger+nepq': 'Soft Challenger',
  'spin+nepq': 'Diagnostic with safety',
};

// Archetype patterns (guide §8). Each condition reads a normalized 0–1 trait;
// `primary` is the archetype's canonical lead technique, used only as a tie-break.
type Cond = (t: Norm) => boolean;
const hi = (v: number) => v >= 0.6;
const lo = (v: number) => v <= 0.4;
const mod = (v: number) => v > 0.4 && v < 0.7;
const modHi = (v: number) => v >= 0.5;

interface Norm {
  d: number; i: number; s: number; cD: number;
  o: number; cn: number; e: number; a: number; n: number;
}

interface ArchetypeDef {
  name: BuyerArchetype;
  primary: SalesTechnique;
  conds: Cond[];
}
const ARCHETYPES: ArchetypeDef[] = [
  { name: 'Strategic Skeptic', primary: 'challenger', conds: [(t) => hi(t.d), (t) => hi(t.cD), (t) => hi(t.o), (t) => hi(t.cn), (t) => lo(t.n)] },
  { name: 'Structured Evaluator', primary: 'spin', conds: [(t) => hi(t.cD), (t) => hi(t.s), (t) => hi(t.cn), (t) => mod(t.n)] },
  { name: 'Trust-First Buyer', primary: 'nepq', conds: [(t) => hi(t.s), (t) => hi(t.a), (t) => modHi(t.n)] },
  { name: 'Relationship Persuader', primary: 'nepq', conds: [(t) => hi(t.i), (t) => hi(t.a), (t) => hi(t.e)] },
  { name: 'Power Buyer', primary: 'challenger', conds: [(t) => hi(t.d), (t) => lo(t.a), (t) => hi(t.o)] },
  { name: 'Risk Controller', primary: 'spin', conds: [(t) => hi(t.cD), (t) => lo(t.o), (t) => hi(t.cn)] },
  { name: 'Stability Seeker', primary: 'nepq', conds: [(t) => hi(t.s), (t) => lo(t.o), (t) => hi(t.a)] },
  { name: 'Visionary Driver', primary: 'challenger', conds: [(t) => hi(t.d), (t) => hi(t.i), (t) => hi(t.o)] },
  { name: 'Anxious Analyst', primary: 'spin', conds: [(t) => hi(t.cD), (t) => hi(t.n), (t) => hi(t.cn)] },
  { name: 'Warm Collaborator', primary: 'nepq', conds: [(t) => hi(t.i), (t) => hi(t.s), (t) => hi(t.a)] },
];

function pickArchetype(t: Norm, primary: SalesTechnique): BuyerArchetype {
  let best = ARCHETYPES[0]!;
  let bestFrac = -1;
  for (const a of ARCHETYPES) {
    const frac = a.conds.filter((c) => c(t)).length / a.conds.length;
    // Strictly-greater keeps the earliest archetype on ties; nudge a tie when the
    // archetype's canonical primary matches the computed primary.
    const adjusted = frac + (a.primary === primary ? 0.001 : 0);
    if (adjusted > bestFrac) {
      bestFrac = adjusted;
      best = a;
    }
  }
  return best.name;
}

/**
 * Match a buyer's DISC + OCEAN profile to a sales technique per the guide.
 * `disc`/`ocean` components are 0–100.
 */
export function matchTechnique(disc: DiscScores, ocean: OceanScores): TechniqueMatch {
  // Normalize to 0–1 (guide §5). DISC-C and OCEAN-Cn are distinct inputs.
  const t: Norm = {
    d: disc.d / 100, i: disc.i / 100, s: disc.s / 100, cD: disc.c / 100,
    o: ocean.o / 100, cn: ocean.c / 100, e: ocean.e / 100, a: ocean.a / 100, n: ocean.n / 100,
  };

  // §5 scoring formula (verbatim).
  const challenger = 0.25 * t.d + 0.2 * t.cD + 0.2 * t.o + 0.2 * t.cn + 0.1 * (1 - t.n) + 0.05 * (1 - t.a);
  const spin = 0.25 * t.cD + 0.2 * t.s + 0.25 * t.cn + 0.1 * t.a + 0.1 * t.n + 0.1 * (1 - t.d);
  const nepq = 0.25 * t.s + 0.2 * t.i + 0.25 * t.a + 0.15 * t.n + 0.1 * t.e + 0.05 * (1 - t.d);

  const ranked: Array<[SalesTechnique, number]> = [
    ['challenger', challenger],
    ['spin', spin],
    ['nepq', nepq],
  ];
  ranked.sort((x, y) => y[1] - x[1]);
  const [primary, primaryScore] = ranked[0]!;
  const [secondary, secondaryScore] = ranked[1]!;

  // §6 confidence: the primary↔secondary gap → Low / Medium / High.
  const gap = primaryScore - secondaryScore;
  const confidenceScore = Math.round(gap * 1000) / 1000;
  const confidenceBand: TechniqueConfidenceBand = gap >= 0.13 ? 'high' : gap >= 0.06 ? 'medium' : 'low';
  const isHybrid = confidenceBand === 'low';

  const copy = COPY[primary];
  return {
    primary,
    secondary,
    buyerArchetype: pickArchetype(t, primary),
    confidenceScore,
    confidenceBand,
    isHybrid,
    hybridStyle: isHybrid ? (HYBRID_STYLE[`${primary}+${secondary}`] ?? null) : null,
    recommendedOpeningStyle: copy.openingStyle,
    avoid: copy.avoid,
    bestQuestionType: copy.bestQuestionType,
    scores: {
      challenger: Math.round(challenger * 1000) / 1000,
      spin: Math.round(spin * 1000) / 1000,
      nepq: Math.round(nepq * 1000) / 1000,
    },
  };
}
