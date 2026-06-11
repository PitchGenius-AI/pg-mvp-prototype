import { z } from 'zod';
import {
  matchedTechniqueSchema,
  psychProfileSchema,
  type MatchedTechnique,
  type PsychProfile,
} from '@pg/shared';
import type { AnthropicClient } from '../client';
import { generateStructured } from '../generate-structured';
import { MODELS } from '../models';

const scriptSectionSchema = z.object({
  heading: z.string(),
  body: z.string(),
});

// Combined pre-call intelligence output: a buyer psych read, the matched
// technique, and a script. The route assembles the final GeneratedScript
// (adding basedOnTemplateId + technique) from these sections.
const precallOutputSchema = z.object({
  psychProfile: psychProfileSchema,
  matchedTechnique: matchedTechniqueSchema,
  scriptSections: z
    .array(scriptSectionSchema)
    .min(3)
    .describe('Ordered sections of the pre-call script: opener, discovery, close, etc.'),
});
export type PrecallOutput = {
  psychProfile: PsychProfile;
  matchedTechnique: MatchedTechnique;
  scriptSections: z.infer<typeof scriptSectionSchema>[];
};

const SYSTEM = `You produce pre-call intelligence for a B2B sales rep about to speak with a buyer.

Output three things:

1. psychProfile — a DISC + OCEAN read of the buyer, inferred from their role, company,
   and any diagnosis signals provided. DISC: 0-100 on each of D/I/S/C plus the dominant
   primaryType. OCEAN: 0-100 on each of openness/conscientiousness/extraversion/
   agreeableness/neuroticism. summary: 2-3 sentences on how to communicate with them.
   This is an inferred first read — be reasonable, not overconfident.

2. matchedTechnique — choose ONE of: challenger, spin, nepq.
   - challenger — for analytical, status-quo-biased, or skeptical buyers who respond to a
     sharp reframe and a teaching insight.
   - spin — for methodical, process-oriented buyers who respond to structured
     situation→problem→implication→need-payoff questioning.
   - nepq — for guarded, relationship-driven, or emotionally-cautious buyers who need a
     low-pressure, trust-first approach.
   Give a one-paragraph reasoning tying the choice to THIS buyer's profile + situation.

3. scriptSections — a concrete pre-call script in the matched technique, grounded in the
   product, the buyer's situation, and (if provided) the rep's script template + the
   latest diagnosis. 3-6 sections, each with a heading and a short actionable body.
   Reference the buyer's actual context — do not write generic filler.`;

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

export async function generatePrecall(
  client: AnthropicClient,
  input: PrecallGeneratorInput,
): Promise<PrecallOutput> {
  const user = [
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
    ``,
    `## Rep's script template (adapt this if present)`,
    input.scriptTemplate ?? '(no template — generate from scratch)',
  ].join('\n');

  return generateStructured({
    client,
    model: MODELS.precall,
    system: SYSTEM,
    user,
    schema: precallOutputSchema,
    schemaName: 'precall_intelligence',
    maxTokens: 4096,
  });
}
