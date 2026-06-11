import {
  readinessDiagnosisSchema,
  type ReadinessDiagnosis,
  type SignalExtraction,
} from '@pg/shared';
import type { AnthropicClient } from '../client';
import { generateStructured } from '../generate-structured';
import { MODELS } from '../models';

const SYSTEM = `You produce a Buyer Readiness Diagnosis from extracted signals + opportunity context.

## readiness_state — exactly one of these 9 states
- unaware — buyer does not recognize the problem
- problem_aware — buyer feels the problem but hasn't framed it
- diagnosis_aligned — buyer agrees with your framing of the problem
- solution_curious — buyer is exploring whether a solution like yours could fit
- solution_confident — buyer believes a solution like yours can solve their problem
- stakeholder_validation_needed — buyer is convinced but must validate with others
- commercially_ready — buyer is working pricing / procurement / implementation / security
- commit_ready — buyer is ready to commit (verbal/explicit commitment signals present)
- at_risk — a previously-advancing deal has regressed, stalled, or gone dark

## Hard product rules — these are non-negotiable. NEVER violate them.
1. Cannot be \`commit_ready\` without explicit commitment signals.
2. Cannot be \`commercially_ready\` without commercial evidence (pricing / procurement /
   implementation / security discussion).
3. Cannot be \`solution_confident\` without solution-confidence signals.
4. Late CRM stage + missing decision evidence ⇒ pipeline_reality_check must be
   \`over_projecting\` at \`high\` or \`critical\` level.
5. Weak or single-source evidence ⇒ confidence_level must be \`low\`.
6. Never invent buyer quotes. Every piece of evidence you cite must actually appear in
   the provided signals — do not fabricate or embellish.
7. Rep subjective notes alone (no transcript/checklist corroboration) cannot produce a
   \`high\` confidence diagnosis.

## Output fields
- readiness_state — per the 9 states + rules above
- readiness_score — 0-100
- confidence_level — low / medium / high, governed by rules 5 + 7
- dimension_scores — for each of the five dimensions (pain, trust, urgency,
  solution_confidence, commitment): a 0-100 score, the evidence behind it, and a short
  diagnosis sentence
- primary_blocker / secondary_blocker — what's actually keeping this buyer from advancing
- pipeline_reality_check — compare the rep's CRM stage to the buyer's evidence-based
  readiness state; apply rule 4
- recommended_next_action — specific, tied to the primary blocker
- what_not_to_do_yet — explicit cautions
- follow_up_email — subject + body, ready to copy
- manager_coaching_note — short framing for a manager review

Cite evidence directly; do not paraphrase in a way that loses provenance. Be explicit
about missing evidence when it materially affects the diagnosis.`;

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
  // Whether the activity recorded any commercial evidence (pricing / budget /
  // implementation / security). Lets rule 2 be enforced deterministically.
  commercialEvidence: boolean;
}

// Server-side enforcement of the deterministic hard rules (the prompt enforces all
// 7; this catches the machine-checkable ones). Returns human-readable violations.
export function checkHardRules(
  diagnosis: ReadinessDiagnosis,
  signals: SignalExtraction,
  commercialEvidence: boolean,
): string[] {
  const violations: string[] = [];
  const allSignals = [
    ...signals.pain,
    ...signals.trust,
    ...signals.urgency,
    ...signals.solution_confidence,
    ...signals.commitment,
    ...signals.risk,
  ];

  if (diagnosis.readiness_state === 'commit_ready' && signals.commitment.length === 0) {
    violations.push(
      'Rule 1: readiness_state is commit_ready but no commitment signals were extracted.',
    );
  }
  if (diagnosis.readiness_state === 'commercially_ready' && !commercialEvidence) {
    violations.push(
      'Rule 2: readiness_state is commercially_ready but there is no commercial evidence (pricing / procurement / implementation / security).',
    );
  }
  if (
    diagnosis.readiness_state === 'solution_confident' &&
    signals.solution_confidence.length === 0
  ) {
    violations.push(
      'Rule 3: readiness_state is solution_confident but no solution-confidence signals were extracted.',
    );
  }
  if (diagnosis.confidence_level === 'high') {
    const nonRepNote = allSignals.some((s) => s.source !== 'rep_note');
    const sources = new Set(allSignals.map((s) => s.source));
    if (!nonRepNote) {
      violations.push(
        'Rule 7: confidence_level is high but every signal is a rep subjective note.',
      );
    }
    if (allSignals.length < 3 || sources.size < 2) {
      violations.push(
        'Rule 5: confidence_level is high but the evidence is weak or single-source.',
      );
    }
  }
  return violations;
}

function buildUserMessage(input: DiagnosisGeneratorInput, repairNote?: string): string {
  return [
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
    `Commercial evidence recorded: ${input.commercialEvidence ? 'yes' : 'no'}`,
    ``,
    `## Extracted signals (JSON)`,
    '```json',
    JSON.stringify(input.signals, null, 2),
    '```',
    ...(repairNote
      ? [
          ``,
          `## Your previous output violated these hard rules — regenerate and fix them:`,
          repairNote,
        ]
      : []),
  ].join('\n');
}

export async function generateDiagnosis(
  client: AnthropicClient,
  input: DiagnosisGeneratorInput,
): Promise<ReadinessDiagnosis> {
  const run = (repairNote?: string) =>
    generateStructured({
      client,
      model: MODELS.diagnosis,
      system: SYSTEM,
      user: buildUserMessage(input, repairNote),
      schema: readinessDiagnosisSchema,
      schemaName: 'readiness_diagnosis',
      maxTokens: 8192,
    });

  const first = await run();
  const violations = checkHardRules(first, input.signals, input.commercialEvidence);
  if (violations.length === 0) return first;

  // One self-repair pass: feed the violations back and regenerate. If it still
  // violates, return the repaired attempt rather than failing the diagnosis.
  return run(violations.map((v) => `- ${v}`).join('\n'));
}
