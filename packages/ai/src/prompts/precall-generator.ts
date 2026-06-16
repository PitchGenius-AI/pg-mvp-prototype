import { z } from 'zod';
import {
  matchTechnique,
  psychProfileSchema,
  salesTechniques,
  type MatchedTechnique,
  type PsychProfile,
  type TechniqueMatch,
} from '@pg/shared';
import type { AnthropicClient } from '../client';
import { generateStructured } from '../generate-structured';
import { MODELS } from '../models';

const scriptSectionSchema = z.object({
  heading: z.string(),
  body: z.string(),
});

export type PrecallOutput = {
  psychProfile: PsychProfile;
  matchedTechnique: MatchedTechnique;
  scriptSections: z.infer<typeof scriptSectionSchema>[];
};

// ── Call 1: buyer psychological profile (DISC + OCEAN) ───────────────────────
const profileOutputSchema = z.object({ psychProfile: psychProfileSchema });

const PROFILE_SYSTEM = `You produce a buyer psychological profile for a B2B sales rep about to speak with a buyer.

Output a psychProfile — a DISC + OCEAN read of the buyer, inferred from their role, company,
and any diagnosis signals provided.
- DISC: 0-100 on each of D/I/S/C plus the dominant primaryType.
- OCEAN: 0-100 on each of openness/conscientiousness/extraversion/agreeableness/neuroticism.
- summary: 2-3 sentences on how to communicate with this buyer.
This is an inferred first read — be reasonable, not overconfident. Do NOT pick a sales
technique; that is decided deterministically from this profile.`;

// ── Call 2: reasoning + next step + script, grounded in the matched technique ─
const scriptOutputSchema = z.object({
  reasoning: z.string().describe('reasoning_summary: why this technique fits THIS buyer'),
  recommendedNextStep: z.string().describe('A concrete next step, in the matched technique'),
  scriptSections: z
    .array(scriptSectionSchema)
    .min(3)
    .describe('Ordered sections of the pre-call script: opener, discovery, close, etc.'),
});

const SCRIPT_SYSTEM = `You produce pre-call copy for a B2B sales rep. The sales technique has ALREADY been
matched to the buyer (deterministically, from their DISC/OCEAN profile) — do NOT second-guess
or change it. Write everything in that matched technique.

Output three things:
1. reasoning — 1 paragraph tying the matched technique to THIS buyer's profile + situation.
2. recommendedNextStep — one concrete next action, phrased in the matched technique's style.
3. scriptSections — a concrete pre-call script in the matched technique (3-6 sections, each a
   heading + short actionable body), grounded in the product, the buyer's situation, and (if
   provided) the rep's script template + latest diagnosis. Honor the technique's opening style,
   its best question type, and its "avoid" list. Reference the buyer's actual context — no
   generic filler.`;

export interface PrecallGeneratorInput {
  buyerName: string;
  buyerTitle: string | null;
  buyerCompany: string;
  productName: string;
  productDescription: string;
  targetBuyer: string;
  problemSolved: string;
  opportunityName: string;
  currentCrmStage: string;
  knownPain: string | null;
  knownObjection: string | null;
  // Optional grounding from the latest diagnosis + the workspace script template.
  diagnosisSummary: string | null;
  scriptTemplate: string | null;
}

function buyerBlock(input: PrecallGeneratorInput): string {
  return [
    `## Buyer`,
    `Name: ${input.buyerName}`,
    `Title: ${input.buyerTitle ?? '(unknown)'}`,
    `Company: ${input.buyerCompany}`,
    ``,
    `## Product`,
    `Name: ${input.productName}`,
    `Description: ${input.productDescription}`,
    `Target buyer: ${input.targetBuyer}`,
    `Problem solved: ${input.problemSolved}`,
    ``,
    `## Opportunity`,
    `Name: ${input.opportunityName}`,
    `Current CRM stage: ${input.currentCrmStage}`,
    `Known pain: ${input.knownPain ?? '(not specified)'}`,
    `Known objection: ${input.knownObjection ?? '(not specified)'}`,
    ``,
    `## Latest diagnosis`,
    input.diagnosisSummary ?? '(no diagnosis yet — infer from the context above)',
  ].join('\n');
}

const TECHNIQUE_LABEL: Record<(typeof salesTechniques)[number], string> = {
  challenger: 'Challenger',
  spin: 'SPIN',
  nepq: 'NEPQ',
};

// Render the deterministic technique match so the script call is grounded in it.
function techniqueBlock(m: TechniqueMatch): string {
  return [
    `## Matched technique (already decided — write in this)`,
    `Primary: ${TECHNIQUE_LABEL[m.primary]}`,
    `Secondary / support: ${TECHNIQUE_LABEL[m.secondary]}`,
    `Buyer archetype: ${m.buyerArchetype}`,
    `Confidence: ${m.confidenceBand}${m.isHybrid && m.hybridStyle ? ` — go hybrid: ${m.hybridStyle} (open in ${TECHNIQUE_LABEL[m.secondary]}, move into ${TECHNIQUE_LABEL[m.primary]})` : ''}`,
    `Recommended opening style: ${m.recommendedOpeningStyle}`,
    `Best question type: ${m.bestQuestionType}`,
    `Avoid: ${m.avoid.join('; ')}`,
  ].join('\n');
}

/**
 * Generate pre-call intelligence: a buyer DISC/OCEAN profile, a DETERMINISTICALLY
 * matched technique (per docs/sales-technique-matching.md §5 — `matchTechnique`,
 * not an LLM guess), and a script written in that technique. Two model calls:
 * (1) infer the profile, (2) write reasoning + next step + script grounded in the
 * matched technique. (PG-310.)
 */
export async function generatePrecall(
  client: AnthropicClient,
  input: PrecallGeneratorInput,
): Promise<PrecallOutput> {
  // 1. Infer the buyer profile.
  const { psychProfile } = await generateStructured({
    client,
    model: MODELS.precall,
    system: PROFILE_SYSTEM,
    user: buyerBlock(input),
    schema: profileOutputSchema,
    schemaName: 'buyer_profile',
    maxTokens: 2048,
  });

  // 2. Deterministically match the technique from the profile (the §5 formula).
  const match = matchTechnique(psychProfile.disc, psychProfile.ocean);

  // 3. Write reasoning + next step + script, grounded in the matched technique.
  const script = await generateStructured({
    client,
    model: MODELS.precall,
    system: SCRIPT_SYSTEM,
    user: [buyerBlock(input), '', techniqueBlock(match), '', `## Rep's script template (adapt this if present)`, input.scriptTemplate ?? '(no template — generate from scratch)'].join('\n'),
    schema: scriptOutputSchema,
    schemaName: 'precall_script',
    maxTokens: 4096,
  });

  return {
    psychProfile,
    matchedTechnique: {
      technique: match.primary,
      reasoning: script.reasoning,
      match,
      recommendedNextStep: script.recommendedNextStep,
    },
    scriptSections: script.scriptSections,
  };
}
