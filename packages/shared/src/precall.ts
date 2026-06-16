import { z } from 'zod';
import { discTypeSchema, salesTechniqueSchema } from './enums';
import { techniqueMatchSchema } from './technique-matching';

// Pre-call intelligence (May-2026 re-scope). Produced from buyer enrichment so a
// rep can prep before the conversation: a psychological profile, a matched sales
// technique, and a generated pre-call script. In the current prototype these are
// mock-generated; the real chains would live in packages/ai alongside the four
// diagnosis chains. This file reverses the CLAUDE.md "No psych profiling" cut.

const score0to100 = z.number().int().min(0).max(100);

// DISC profile — Dominance / Influence / Steadiness / Conscientiousness, each a
// 0–100 score, plus the dominant quadrant.
export const discProfileSchema = z.object({
  d: score0to100,
  i: score0to100,
  s: score0to100,
  c: score0to100,
  primaryType: discTypeSchema,
});
export type DiscProfile = z.infer<typeof discProfileSchema>;

// OCEAN / Big Five — Openness / Conscientiousness / Extraversion /
// Agreeableness / Neuroticism, each a 0–100 score.
export const oceanProfileSchema = z.object({
  o: score0to100,
  c: score0to100,
  e: score0to100,
  a: score0to100,
  n: score0to100,
});
export type OceanProfile = z.infer<typeof oceanProfileSchema>;

// Combined psychological profile of the buyer.
export const psychProfileSchema = z.object({
  disc: discProfileSchema,
  ocean: oceanProfileSchema,
  summary: z.string().describe('Short narrative read of how to communicate with this buyer'),
});
export type PsychProfile = z.infer<typeof psychProfileSchema>;

// The sales technique matched to the buyer (Challenger / SPIN / NEPQ) + why.
//
// `technique` (= the primary) and `reasoning` are the back-compat surface every
// consumer already reads. `match` carries the full guide output (PG-310) —
// deterministically computed by `matchTechnique` (§5 formula), not an LLM guess —
// and `recommendedNextStep` is the AI-suggested next action. Both are OPTIONAL so
// historical `precall_intelligence` rows (which only have technique + reasoning)
// still pass `precallIntelligenceSchema.parse()` on read.
export const matchedTechniqueSchema = z.object({
  technique: salesTechniqueSchema,
  reasoning: z.string().describe('Why this technique fits this buyer (reasoning_summary)'),
  match: techniqueMatchSchema.optional(),
  recommendedNextStep: z.string().optional(),
});
export type MatchedTechnique = z.infer<typeof matchedTechniqueSchema>;

// A generated, per-opportunity pre-call script — distinct from the reusable
// workspace-level script template (see scriptTemplateSchema in entities.ts).
export const generatedScriptSectionSchema = z.object({
  heading: z.string(),
  body: z.string(),
});

export const generatedScriptSchema = z.object({
  // The workspace script template this was generated from, if any.
  basedOnTemplateId: z.string().nullable(),
  technique: salesTechniqueSchema,
  sections: z.array(generatedScriptSectionSchema),
});
export type GeneratedScript = z.infer<typeof generatedScriptSchema>;

// The full pre-call intelligence bundle for a single opportunity — the unit the
// mock store keys by opportunity id, mirroring how diagnoses are stored.
export const precallIntelligenceSchema = z.object({
  id: z.string(),
  opportunityId: z.string(),
  psychProfile: psychProfileSchema,
  matchedTechnique: matchedTechniqueSchema,
  generatedScript: generatedScriptSchema,
  generatedAt: z.string(),
});
export type PrecallIntelligence = z.infer<typeof precallIntelligenceSchema>;
