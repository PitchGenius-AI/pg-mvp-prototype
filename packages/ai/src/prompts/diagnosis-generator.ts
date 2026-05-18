import {
  readinessDiagnosisSchema,
  type ReadinessDiagnosis,
  type SignalExtraction,
} from '@pg/shared';
import type { AnthropicClient } from '../client';
import { generateStructured } from '../generate-structured';
import { MODELS } from '../models';

const SYSTEM = `You produce a Buyer Readiness Diagnosis from extracted signals + opportunity context.

You output:
- readiness_state — one of the 8 states. Hard rules:
  * Cannot be commit_ready without commitment signals
  * Cannot be commercially_ready without commercial evidence (pricing / procurement /
    implementation / security discussion)
  * Cannot be solution_confident without solution_confidence signals
- readiness_score — 0-100
- confidence_level — low if evidence is thin or contradictory; high only with rich
  multi-source evidence
- dimension_scores — for each of the five dimensions (pain, trust, urgency,
  solution_confidence, commitment), a 0-100 score, the evidence behind it, and a
  short diagnosis sentence
- primary_blocker / secondary_blocker — what's actually keeping this buyer from
  advancing
- pipeline_reality_check — compare the rep's CRM stage to the buyer's evidence-based
  readiness state. Late stage + missing decision evidence = high or critical
  over-projection
- recommended_next_action — specific, tied to the primary blocker
- what_not_to_do_yet — explicit cautions
- follow_up_email — subject + body, ready to copy
- manager_coaching_note — short framing for a manager review

Separation rules (mandatory for trust):
- Cite evidence directly. Do not paraphrase in a way that loses provenance.
- Rep subjective notes alone cannot produce high-confidence diagnosis.
- Be explicit about missing evidence when it materially affects the diagnosis.
`;

export interface DiagnosisGeneratorInput {
  productName: string;
  productDescription: string;
  targetBuyer: string;
  problemSolved: string;
  opportunityName: string;
  buyerCompany: string;
  currentCrmStage: string;
  knownPain: string | null;
  knownObjection: string | null;
  signals: SignalExtraction;
  priorReadinessState: string | null;
}

export async function generateDiagnosis(
  client: AnthropicClient,
  input: DiagnosisGeneratorInput,
): Promise<ReadinessDiagnosis> {
  const userMsg = [
    `## Product context`,
    `Name: ${input.productName}`,
    `Description: ${input.productDescription}`,
    `Target buyer: ${input.targetBuyer}`,
    `Problem solved: ${input.problemSolved}`,
    ``,
    `## Opportunity`,
    `Name: ${input.opportunityName}`,
    `Buyer company: ${input.buyerCompany}`,
    `Current CRM stage: ${input.currentCrmStage}`,
    `Known pain: ${input.knownPain ?? '(not specified)'}`,
    `Known objection: ${input.knownObjection ?? '(not specified)'}`,
    `Prior readiness state: ${input.priorReadinessState ?? '(first diagnosis)'}`,
    ``,
    `## Extracted signals (JSON)`,
    '```json',
    JSON.stringify(input.signals, null, 2),
    '```',
  ].join('\n');

  return generateStructured({
    client,
    model: MODELS.diagnosis,
    system: SYSTEM,
    user: userMsg,
    schema: readinessDiagnosisSchema,
    schemaName: 'readiness_diagnosis',
    maxTokens: 8192,
  });
}
