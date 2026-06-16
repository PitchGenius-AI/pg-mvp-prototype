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
about missing evidence when it materially affects the diagnosis.

## Evolving an existing diagnosis (when a prior diagnosis is provided)
A buyer's readiness is cumulative — it is the whole relationship, not just the latest
touch. When a PRIOR DIAGNOSIS is provided, treat it as the accumulated picture of the
deal so far and the NEW ACTIVITY as fresh evidence that updates it. Specifically:
- Start from the prior state and EVOLVE it. Do not silently forget progress: commitment,
  commercial evidence, or solution-confidence established earlier still count unless the
  new activity contradicts or supersedes it.
- Confirm, upgrade, or downgrade based on what the new activity actually adds. A thin or
  administrative latest activity (e.g. a scheduling email) should not collapse a deal
  that was genuinely advanced — carry the prior state forward.
- If the new evidence shows the deal has stalled, gone dark, lost a champion, or reversed
  a prior commitment, move it to \`at_risk\` and say why.
- The recent-signal history below is granular detail for the most recent activities; the
  prior diagnosis is the rolling synthesis of everything before that.`;

export interface PriorDiagnosisContext {
  readinessState: string;
  readinessScore: number;
  confidenceLevel: string;
  primaryBlocker: string | null;
  secondaryBlocker: string | null;
  alignmentOutcome: string;
  recommendedNextAction: string;
  // Per-dimension synthesis from the prior diagnosis (the rolling summary).
  dimensions: Array<{ dimension: string; score: number; diagnosis: string }>;
  diagnosedAt: string | null;
}

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
  // The latest prior diagnosis (the rolling synthesis of all earlier activity).
  // Null on the first diagnosis for an opportunity.
  priorDiagnosis: PriorDiagnosisContext | null;
  // The most recent prior activities' extracted signals (capped window), oldest
  // → newest, EXCLUDING the current activity. Granular recent detail on top of the
  // prior-diagnosis summary. Empty on the first diagnosis.
  recentSignals: SignalExtraction[];
  // Whether the activity recorded any commercial evidence (pricing / budget /
  // implementation / security). Lets rule 2 be enforced deterministically.
  commercialEvidence: boolean;
}

// Readiness states at or beyond which a given kind of evidence has been established,
// so a sparse latest activity doesn't trip the hard-rule check into a false downgrade.
const COMMIT_ESTABLISHED = new Set(['commit_ready']);
const COMMERCIAL_ESTABLISHED = new Set(['commercially_ready', 'commit_ready']);
const SOLUTION_CONFIDENCE_ESTABLISHED = new Set([
  'solution_confident',
  'stakeholder_validation_needed',
  'commercially_ready',
  'commit_ready',
]);

// Merge several signal extractions into one cumulative set (concatenate per
// dimension). Used so the hard-rule evidence checks see the whole recent window,
// not just the latest activity.
export function mergeSignals(extractions: SignalExtraction[]): SignalExtraction {
  const empty: SignalExtraction = {
    pain: [],
    trust: [],
    urgency: [],
    solution_confidence: [],
    commitment: [],
    risk: [],
    missing_evidence: [],
  };
  return extractions.reduce<SignalExtraction>(
    (acc, s) => ({
      pain: [...acc.pain, ...s.pain],
      trust: [...acc.trust, ...s.trust],
      urgency: [...acc.urgency, ...s.urgency],
      solution_confidence: [...acc.solution_confidence, ...s.solution_confidence],
      commitment: [...acc.commitment, ...s.commitment],
      risk: [...acc.risk, ...s.risk],
      missing_evidence: [...acc.missing_evidence, ...s.missing_evidence],
    }),
    empty,
  );
}

// Server-side enforcement of the deterministic hard rules (the prompt enforces all
// 7; this catches the machine-checkable ones). Returns human-readable violations.
//
// `signals` is the CUMULATIVE set across the recent activity window, and
// `priorReadinessState` is the state carried in from the prior diagnosis. Together
// they relax rules 1–3: a state established earlier (e.g. commitment in a prior
// call) still counts, so a sparse latest activity can't trip a false violation.
export function checkHardRules(
  diagnosis: ReadinessDiagnosis,
  signals: SignalExtraction,
  commercialEvidence: boolean,
  priorReadinessState: string | null = null,
): string[] {
  const violations: string[] = [];
  const prior = priorReadinessState ?? '';
  const allSignals = [
    ...signals.pain,
    ...signals.trust,
    ...signals.urgency,
    ...signals.solution_confidence,
    ...signals.commitment,
    ...signals.risk,
  ];

  if (
    diagnosis.readiness_state === 'commit_ready' &&
    signals.commitment.length === 0 &&
    !COMMIT_ESTABLISHED.has(prior)
  ) {
    violations.push(
      'Rule 1: readiness_state is commit_ready but no commitment signals appear in the recent window or prior diagnosis.',
    );
  }
  if (
    diagnosis.readiness_state === 'commercially_ready' &&
    !commercialEvidence &&
    !COMMERCIAL_ESTABLISHED.has(prior)
  ) {
    violations.push(
      'Rule 2: readiness_state is commercially_ready but there is no commercial evidence (pricing / procurement / implementation / security).',
    );
  }
  if (
    diagnosis.readiness_state === 'solution_confident' &&
    signals.solution_confidence.length === 0 &&
    !SOLUTION_CONFIDENCE_ESTABLISHED.has(prior)
  ) {
    violations.push(
      'Rule 3: readiness_state is solution_confident but no solution-confidence signals appear in the recent window or prior diagnosis.',
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

// Render the prior diagnosis (the rolling synthesis) as a compact block.
function priorDiagnosisBlock(prior: PriorDiagnosisContext): string {
  const dims = prior.dimensions
    .map((d) => `  - ${d.dimension}: ${d.score}/100 — ${d.diagnosis}`)
    .join('\n');
  return [
    `## Prior diagnosis (the accumulated picture so far — EVOLVE this)`,
    `State: ${prior.readinessState} (${prior.readinessScore}/100, ${prior.confidenceLevel} confidence)`,
    `Alignment: ${prior.alignmentOutcome}`,
    `Primary blocker: ${prior.primaryBlocker ?? '(none)'}`,
    `Secondary blocker: ${prior.secondaryBlocker ?? '(none)'}`,
    `Last recommended next action: ${prior.recommendedNextAction}`,
    prior.diagnosedAt ? `Diagnosed at: ${prior.diagnosedAt}` : '',
    `Dimensions:`,
    dims || '  (none)',
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildUserMessage(input: DiagnosisGeneratorInput, repairNote?: string): string {
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
    `Commercial evidence recorded (this activity): ${input.commercialEvidence ? 'yes' : 'no'}`,
    ``,
    ...(input.priorDiagnosis ? [priorDiagnosisBlock(input.priorDiagnosis), ``] : []),
    ...(input.recentSignals.length > 0
      ? [
          `## Recent activity signals (most recent prior activities, oldest → newest)`,
          '```json',
          JSON.stringify(input.recentSignals, null, 2),
          '```',
          ``,
        ]
      : []),
    `## New activity signals (the latest activity — primary fresh evidence)`,
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

  // The hard-rule evidence checks see the cumulative recent window + the prior
  // state, so a state legitimately established earlier isn't flagged as a
  // violation just because the latest activity didn't restate it.
  const cumulativeSignals = mergeSignals([...input.recentSignals, input.signals]);
  const cumulativeCommercial =
    input.commercialEvidence || COMMERCIAL_ESTABLISHED.has(input.priorReadinessState ?? '');

  const first = await run();
  const violations = checkHardRules(
    first,
    cumulativeSignals,
    cumulativeCommercial,
    input.priorReadinessState,
  );
  if (violations.length === 0) return first;

  // One self-repair pass: feed the violations back and regenerate. If it still
  // violates, return the repaired attempt rather than failing the diagnosis.
  return run(violations.map((v) => `- ${v}`).join('\n'));
}
