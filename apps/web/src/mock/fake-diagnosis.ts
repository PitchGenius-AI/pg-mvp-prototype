import {
  SIMPLE_B2B_SALES_STAGES,
  STAGE_IMPLIED_READINESS,
  readinessStates,
  type AlignmentLevel,
  type AlignmentOutcome,
  type ConfidenceLevel,
  type ReadinessDiagnosis,
  type ReadinessState,
  type Signal,
  type SignalExtraction,
} from '@pg/shared';
import type { MockActivity, MockBuyer, MockOpportunity, MockProduct } from './types';

// Heuristic-light stand-in for the real Anthropic signal-extraction + diagnosis
// chains. Scans the interaction text + checklist flags + rep notes for keywords,
// produces a believable SignalExtraction, then derives a ReadinessDiagnosis from
// the signal counts + opportunity context.
//
// Not as smart as the real chain, but produces output that feels customized to
// what the user typed — good enough for the demo's add-interaction flow.

interface GenerateInput {
  opportunity: MockOpportunity;
  buyer: MockBuyer | null;
  product: MockProduct | null;
  activity: MockActivity;
  repName?: string;
}

interface GenerateResult {
  signalExtraction: SignalExtraction;
  diagnosis: ReadinessDiagnosis;
}

type DimensionKey =
  | 'pain'
  | 'trust'
  | 'urgency'
  | 'solution_confidence'
  | 'commitment'
  | 'risk';

// Keyword patterns → signal hints, grouped by dimension. Each match adds one
// signal to the extraction with the matched sentence as evidence.
const DIMENSION_KEYWORDS: Record<DimensionKey, { keyword: RegExp; signal: string }[]> = {
  pain: [
    { keyword: /\bpain\b|frustrat|struggl|broken|losing|missing/i, signal: 'Buyer-stated pain point' },
    { keyword: /can'?t|don'?t (?:have|work)|problem|issue/i, signal: 'Operational friction acknowledged' },
    { keyword: /forecast|miss(ed)? quota|board reporting|cfo/i, signal: 'Top-down pressure visible' },
  ],
  trust: [
    { keyword: /\b(trust|confidence|relationship|known each other|champion)\b/i, signal: 'Trust signal in the conversation' },
    { keyword: /\b(prior customer|previous engagement|worked together)\b/i, signal: 'Established history with seller' },
  ],
  urgency: [
    { keyword: /\b(deadline|by (?:end of|eom|eoq|june|july|august|sept|oct|nov|dec)|next (?:week|month|quarter))\b/i, signal: 'Named timeline / deadline' },
    { keyword: /\b(renew(al)?|contract expir|q[1-4])\b/i, signal: 'Contractual forcing function' },
    { keyword: /\b(asap|urgent|right away|immediately)\b/i, signal: 'Explicit urgency language' },
  ],
  solution_confidence: [
    { keyword: /\b(pilot|poc|trial|demo|hands-?on)\b/i, signal: 'Proof-mechanism in motion' },
    { keyword: /\b(roi|business case|cost saving|outcome|result)\b/i, signal: 'Outcomes-oriented framing' },
    { keyword: /\b(competit|alternative|evaluat|compar)/i, signal: 'Competitive consideration in play' },
  ],
  commitment: [
    { keyword: /\b(next step|follow.?up|paper|signature|signed|procurement|legal)\b/i, signal: 'Commitment / paper step named' },
    { keyword: /\b(stakeholder|sponsor|exec|vp|cro|cfo|ceo)\b/i, signal: 'Additional stakeholder engaged' },
    { keyword: /\b(budget|pricing|cost|invoice|payment)\b/i, signal: 'Commercial conversation underway' },
  ],
  risk: [
    { keyword: /\b(slip|delay|defer|push (?:back|out)|on hold|pause)\b/i, signal: 'Timeline slip risk' },
    { keyword: /\b(reorg|re-?org|leadership change|new (?:cro|ceo))\b/i, signal: 'Organizational change risk' },
    { keyword: /\b(security|compliance|soc.?2|gdpr|hipaa|legal)\b/i, signal: 'Security / compliance gate' },
    { keyword: /\b(silent|ghost|stopped responding|haven'?t heard)\b/i, signal: 'Buyer engagement decay' },
  ],
};

const STAGE_ORDER: ReadinessState[] = [
  'unaware',
  'problem_aware',
  'diagnosis_aligned',
  'solution_curious',
  'solution_confident',
  'stakeholder_validation_needed',
  'commercially_ready',
  'commit_ready',
];

export function fakeGenerateDiagnosis(input: GenerateInput): GenerateResult {
  const { opportunity, buyer, activity, repName } = input;
  const text = [
    activity.transcriptOrNotes ?? '',
    activity.repSubjectiveNotes ? `[Rep note] ${activity.repSubjectiveNotes}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const signalExtraction = extractSignals(text, activity);
  const dimensionScores = scoreDimensions(signalExtraction, activity);
  const readinessState = inferReadinessState(dimensionScores, opportunity);
  const readinessScore = computeOverallScore(dimensionScores);
  const confidence = inferConfidence(signalExtraction, activity);
  const { outcome, level, reason } = computePipelineRealityCheck(
    opportunity.currentCrmStage,
    readinessState,
  );

  const primaryBlocker = derivePrimaryBlocker(signalExtraction, dimensionScores);
  const secondaryBlocker = deriveSecondaryBlocker(signalExtraction, dimensionScores);
  const nextAction = deriveRecommendedAction(readinessState, outcome);
  const whatNotToDoYet = deriveWhatNotToDo(readinessState, outcome);
  const followUpEmail = deriveFollowUpEmail(buyer, opportunity, readinessState, outcome, repName);
  const coachingNote = deriveCoachingNote(opportunity, readinessState, outcome, level);

  const diagnosis: ReadinessDiagnosis = {
    readiness_state: readinessState,
    readiness_score: readinessScore,
    confidence_level: confidence,
    dimension_scores: (['pain', 'trust', 'urgency', 'solution_confidence', 'commitment'] as const).map(
      (dim) => ({
        dimension: dim,
        score: dimensionScores[dim].score,
        evidence: dimensionScores[dim].evidence,
        diagnosis: dimensionScores[dim].narrative,
      }),
    ),
    primary_blocker: primaryBlocker,
    secondary_blocker: secondaryBlocker,
    pipeline_reality_check: {
      crm_stage: opportunity.currentCrmStage,
      readiness_state: readinessState,
      outcome,
      level,
      reason,
    },
    recommended_next_action: nextAction,
    what_not_to_do_yet: whatNotToDoYet,
    follow_up_email: followUpEmail,
    manager_coaching_note: coachingNote,
  };

  return { signalExtraction, diagnosis };
}

// --- Signal extraction ---

function extractSignals(text: string, interaction: MockActivity): SignalExtraction {
  const sentences = splitSentences(text);
  const extraction: SignalExtraction = {
    pain: [],
    trust: [],
    urgency: [],
    solution_confidence: [],
    commitment: [],
    risk: [],
    missing_evidence: [],
  };

  for (const sentence of sentences) {
    for (const [dimension, patterns] of Object.entries(DIMENSION_KEYWORDS) as [
      DimensionKey,
      typeof DIMENSION_KEYWORDS.pain,
    ][]) {
      for (const { keyword, signal } of patterns) {
        if (keyword.test(sentence)) {
          extraction[dimension].push({
            signal,
            evidence: sentence.trim().slice(0, 200),
            source: sentenceSource(sentence),
            strength: signalStrength(sentence),
            dimension,
          });
          break;
        }
      }
    }
  }

  // Lift checklist flags into checklist-sourced signals.
  if (interaction.nextStepAgreed) {
    extraction.commitment.push({
      signal: 'Next step agreed',
      evidence: 'Checklist: next step agreed = yes',
      source: 'checklist',
      strength: 'strong',
      dimension: 'commitment',
    });
  }
  if (interaction.stakeholderAdded) {
    extraction.commitment.push({
      signal: 'New stakeholder added',
      evidence: 'Checklist: stakeholder added = yes',
      source: 'checklist',
      strength: 'medium',
      dimension: 'commitment',
    });
  }
  if (interaction.pricingDiscussed) {
    extraction.commitment.push({
      signal: 'Pricing discussed',
      evidence: 'Checklist: pricing discussed = yes',
      source: 'checklist',
      strength: 'medium',
      dimension: 'commitment',
    });
  }
  if (interaction.budgetDiscussed) {
    extraction.solution_confidence.push({
      signal: 'Budget conversation underway',
      evidence: 'Checklist: budget discussed = yes',
      source: 'checklist',
      strength: 'medium',
      dimension: 'solution_confidence',
    });
  }
  if (interaction.implementationDiscussed) {
    extraction.solution_confidence.push({
      signal: 'Implementation scope discussed',
      evidence: 'Checklist: implementation discussed = yes',
      source: 'checklist',
      strength: 'medium',
      dimension: 'solution_confidence',
    });
  }
  if (interaction.securityDiscussed) {
    extraction.risk.push({
      signal: 'Security review surface raised',
      evidence: 'Checklist: security discussed = yes',
      source: 'checklist',
      strength: 'medium',
      dimension: 'risk',
    });
  }
  if (interaction.competitorDiscussed) {
    extraction.solution_confidence.push({
      signal: 'Competitive consideration discussed',
      evidence: 'Checklist: competitor discussed = yes',
      source: 'checklist',
      strength: 'medium',
      dimension: 'solution_confidence',
    });
  }

  extraction.missing_evidence = deriveMissingEvidence(extraction, interaction);

  return extraction;
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function sentenceSource(sentence: string): Signal['source'] {
  if (/^\[Rep note\]/i.test(sentence)) return 'rep_note';
  return 'transcript';
}

function signalStrength(sentence: string): Signal['strength'] {
  // Heuristic: longer, more declarative sentences = stronger; hedging language = weaker.
  if (/\b(maybe|might|possibly|not sure|i think)\b/i.test(sentence)) return 'weak';
  if (/\b(definitely|absolutely|will|committed|signed|yes)\b/i.test(sentence)) return 'strong';
  return 'medium';
}

function deriveMissingEvidence(
  extraction: SignalExtraction,
  interaction: MockActivity,
): string[] {
  const missing: string[] = [];
  if (!interaction.budgetDiscussed && extraction.commitment.length === 0) {
    missing.push('No budget conversation captured.');
  }
  if (!interaction.stakeholderAdded && extraction.commitment.length < 2) {
    missing.push('Only a single stakeholder in the conversation so far.');
  }
  if (!interaction.implementationDiscussed && extraction.solution_confidence.length === 0) {
    missing.push('No implementation discussion — feasibility is unknown.');
  }
  if (!interaction.securityDiscussed) {
    missing.push('No security / compliance discussion captured.');
  }
  if (extraction.pain.length === 0) {
    missing.push('No clearly-articulated pain in the buyer\'s own words.');
  }
  return missing;
}

// --- Scoring ---

interface DimensionScore {
  score: number;
  evidence: string[];
  narrative: string;
}

function scoreDimensions(
  extraction: SignalExtraction,
  interaction: MockActivity,
): Record<DimensionKey, DimensionScore> {
  const dims: DimensionKey[] = ['pain', 'trust', 'urgency', 'solution_confidence', 'commitment'];
  const result = {} as Record<DimensionKey, DimensionScore>;

  for (const dim of dims) {
    const signals = extraction[dim] ?? [];
    let score = signals.reduce(
      (sum, s) => sum + (s.strength === 'strong' ? 25 : s.strength === 'medium' ? 15 : 8),
      20,
    );
    // Risk drags down trust slightly when present.
    if (dim === 'trust' && extraction.risk.length > 0) score -= 10;
    score = Math.max(5, Math.min(95, score));

    result[dim] = {
      score,
      evidence: signals.slice(0, 3).map((s) => s.evidence),
      narrative: narrativeFor(dim, signals.length, interaction),
    };
  }

  // Risk gets its own pseudo-score for blocker derivation but isn't a dimension_scores entry.
  result.risk = {
    score: 50,
    evidence: extraction.risk.slice(0, 3).map((s) => s.evidence),
    narrative: '',
  };

  return result;
}

function narrativeFor(
  dim: DimensionKey,
  signalCount: number,
  _interaction: MockActivity,
): string {
  if (signalCount === 0) return `No clear ${dim.replace(/_/g, ' ')} signals in this evidence.`;
  if (signalCount === 1) return `One ${dim.replace(/_/g, ' ')} signal — early but real.`;
  if (signalCount < 4) return `Multiple ${dim.replace(/_/g, ' ')} signals; trend is building.`;
  return `Strong ${dim.replace(/_/g, ' ')} signal density — well-supported.`;
}

function computeOverallScore(scores: Record<DimensionKey, DimensionScore>): number {
  // Average of the five dimensions (risk excluded).
  const dims: DimensionKey[] = ['pain', 'trust', 'urgency', 'solution_confidence', 'commitment'];
  const avg = dims.reduce((s, d) => s + scores[d].score, 0) / dims.length;
  return Math.round(avg);
}

function inferReadinessState(
  scores: Record<DimensionKey, DimensionScore>,
  opportunity: MockOpportunity,
): ReadinessState {
  const commitment = scores.commitment.score;
  const solutionConfidence = scores.solution_confidence.score;
  const pain = scores.pain.score;
  const urgency = scores.urgency.score;

  // Walk up the funnel; each promotion requires the corresponding signal threshold.
  let state: ReadinessState = 'unaware';
  if (pain >= 35) state = 'problem_aware';
  if (pain >= 50 && urgency >= 35) state = 'diagnosis_aligned';
  if (solutionConfidence >= 40) state = 'solution_curious';
  if (solutionConfidence >= 60) state = 'solution_confident';
  if (solutionConfidence >= 65 && commitment >= 40) state = 'stakeholder_validation_needed';
  if (commitment >= 65) state = 'commercially_ready';
  if (commitment >= 80 && solutionConfidence >= 70) state = 'commit_ready';

  // Don't drift too far below the existing state — once you've been diagnosed
  // higher, a single weak interaction shouldn't tank the reading.
  if (opportunity.currentReadinessState) {
    const prevIdx = STAGE_ORDER.indexOf(opportunity.currentReadinessState);
    const nextIdx = STAGE_ORDER.indexOf(state);
    if (prevIdx > nextIdx + 1) {
      // Limit drift to 1 stage backward unless this is a much weaker conversation.
      return STAGE_ORDER[Math.max(0, prevIdx - 1)] ?? state;
    }
  }
  return state;
}

function inferConfidence(
  extraction: SignalExtraction,
  interaction: MockActivity,
): ConfidenceLevel {
  const totalSignals = readinessStates // any iterable of constants
    ? Object.values(extraction).reduce(
        (sum, v) => sum + (Array.isArray(v) ? v.length : 0),
        0,
      )
    : 0;
  const transcriptSignals = Object.values(extraction)
    .filter(Array.isArray)
    .flat()
    .filter((s): s is Signal => typeof s === 'object' && 'source' in s && s.source === 'transcript')
    .length;

  if (totalSignals < 3) return 'low';
  if (transcriptSignals === 0) return 'low';
  if (transcriptSignals < 3) return 'medium';
  if (!interaction.transcriptOrNotes || interaction.transcriptOrNotes.length < 200) return 'medium';
  return 'high';
}

// --- Pipeline Reality Check ---

function computePipelineRealityCheck(
  crmStage: string,
  readinessState: ReadinessState,
): { outcome: AlignmentOutcome; level: AlignmentLevel; reason: string } {
  const impliedReadiness = STAGE_IMPLIED_READINESS[
    crmStage as keyof typeof STAGE_IMPLIED_READINESS
  ] as ReadinessState | undefined;
  if (!impliedReadiness) {
    return {
      outcome: 'aligned',
      level: 'none',
      reason: `Custom CRM stage "${crmStage}" — no implied readiness mapping. Treating as aligned by default.`,
    };
  }
  const impliedIdx = STAGE_ORDER.indexOf(impliedReadiness);
  const actualIdx = STAGE_ORDER.indexOf(readinessState);
  const delta = impliedIdx - actualIdx;
  // Positive delta = CRM is AHEAD of buyer evidence → rep is over-projecting.
  if (delta === 0) {
    return {
      outcome: 'aligned',
      level: 'none',
      reason: `CRM ${crmStage} implies ${humanize(impliedReadiness)}, which matches the buyer's state exactly.`,
    };
  }
  if (delta > 0) {
    const level = severityFromDelta(delta);
    return {
      outcome: 'over_projecting',
      level,
      reason: `CRM ${crmStage} implies ${humanize(impliedReadiness)}, but the buyer's evidence puts them at ${humanize(readinessState)} — ${delta} stage${delta === 1 ? '' : 's'} of gap.`,
    };
  }
  const level = severityFromDelta(-delta);
  return {
    outcome: 'under_projecting',
    level,
    reason: `CRM ${crmStage} implies ${humanize(impliedReadiness)}, but the buyer's evidence puts them at ${humanize(readinessState)} — this deal is ${-delta} stage${-delta === 1 ? '' : 's'} further along than the CRM suggests.`,
  };
}

function severityFromDelta(d: number): AlignmentLevel {
  if (d >= 4) return 'critical';
  if (d === 3) return 'high';
  if (d === 2) return 'medium';
  return 'low';
}

// --- Derived narrative ---

function derivePrimaryBlocker(
  extraction: SignalExtraction,
  scores: Record<DimensionKey, DimensionScore>,
): string {
  if (extraction.risk.length > 0) {
    return extraction.risk[0]!.signal;
  }
  const weakest = (['commitment', 'solution_confidence', 'urgency', 'pain', 'trust'] as const)
    .map((d) => ({ d, score: scores[d].score }))
    .sort((a, b) => a.score - b.score)[0];
  if (!weakest) return 'No blockers identified.';
  return `${humanize(weakest.d)} is the weakest dimension (${weakest.score}/100) — strengthen this before pushing forward.`;
}

function deriveSecondaryBlocker(
  extraction: SignalExtraction,
  scores: Record<DimensionKey, DimensionScore>,
): string | null {
  if (extraction.risk.length > 1) return extraction.risk[1]!.signal;
  if (extraction.missing_evidence.length > 0) return extraction.missing_evidence[0] ?? null;
  const second = (['commitment', 'solution_confidence', 'urgency'] as const)
    .map((d) => ({ d, score: scores[d].score }))
    .sort((a, b) => a.score - b.score)[1];
  return second ? `${humanize(second.d)} needs reinforcement.` : null;
}

function deriveRecommendedAction(
  readinessState: ReadinessState,
  outcome: AlignmentOutcome,
): string {
  if (outcome === 'over_projecting') {
    switch (readinessBucket(readinessState)) {
      case 'early':
        return 'Pause commercial pressure. Run a proper discovery call before any further sales motion.';
      case 'mid':
        return 'Pause commercial pressure. Validate solution fit with the right stakeholders before pushing forward.';
      case 'late':
        return 'Pause commercial pressure. Re-confirm decision criteria and economic-buyer alignment before paper.';
    }
  }
  if (outcome === 'under_projecting') {
    return `This deal is ahead of where you're tracking it. Move the CRM stage forward and align next steps to ${humanize(readinessState)}.`;
  }
  switch (readinessState) {
    case 'unaware':
    case 'problem_aware':
      return 'Run a discovery call focused on pain and impact before any solution conversation.';
    case 'diagnosis_aligned':
    case 'solution_curious':
      return 'Set up a tailored demo focused on the specific pain point identified.';
    case 'solution_confident':
    case 'stakeholder_validation_needed':
      return 'Loop in the remaining stakeholders to validate the solution before commercial.';
    case 'commercially_ready':
    case 'commit_ready':
      return 'Move to paper. Confirm signature timeline and kickoff plan.';
    case 'at_risk':
      return 'Treat this as a re-open: re-qualify whether the deal still exists before any further sales motion.';
  }
}

type ReadinessBucket = 'early' | 'mid' | 'late';

function readinessBucket(state: ReadinessState): ReadinessBucket {
  switch (state) {
    case 'unaware':
    case 'problem_aware':
      return 'early';
    case 'diagnosis_aligned':
    case 'solution_curious':
    case 'solution_confident':
    case 'at_risk':
      return 'mid';
    case 'stakeholder_validation_needed':
    case 'commercially_ready':
    case 'commit_ready':
      return 'late';
  }
}

function deriveWhatNotToDo(
  readinessState: ReadinessState,
  outcome: AlignmentOutcome,
): string[] {
  const items: string[] = [];
  if (outcome === 'over_projecting') {
    items.push('Do not send pricing — the deal is not ready.');
    items.push('Do not lock in a close date until qualification is restored.');
  }
  if (readinessState === 'unaware' || readinessState === 'problem_aware') {
    items.push('Do not run a product demo yet — pain alignment comes first.');
  }
  if (items.length === 0) {
    items.push('Do not introduce new commercial variables — close the core path first.');
  }
  return items;
}

function deriveFollowUpEmail(
  buyer: MockBuyer | null,
  opportunity: MockOpportunity,
  readinessState: ReadinessState,
  outcome: AlignmentOutcome,
  repName: string | undefined,
): { subject: string; body: string } {
  const firstName = buyer?.firstName ?? 'there';
  const repFirst = ((repName ?? '').trim().split(/\s+/)[0] ?? '').trim();
  const signOff = repFirst || 'Casey';
  const opp = opportunity.opportunityName;
  const bucket = readinessBucket(readinessState);
  return {
    subject: followUpSubject(opp, outcome),
    body: followUpBody(bucket, outcome, { firstName, signOff }),
  };
}

function followUpSubject(opportunityName: string, outcome: AlignmentOutcome): string {
  switch (outcome) {
    case 'over_projecting':
      return `Quick step back: ${opportunityName}`;
    case 'under_projecting':
      return `Next step on ${opportunityName}`;
    case 'aligned':
      return `Follow-up: ${opportunityName}`;
  }
}

// Templates keyed by (readiness bucket × outcome). Each body is parameterised
// only on buyer first name + rep sign-off — no string-jamming of blockers.
function followUpBody(
  bucket: ReadinessBucket,
  outcome: AlignmentOutcome,
  ctx: { firstName: string; signOff: string },
): string {
  const { firstName, signOff } = ctx;
  const key = `${bucket}:${outcome}` as const;
  const template = FOLLOW_UP_TEMPLATES[key];
  return template({ firstName, signOff });
}

type FollowUpKey = `${ReadinessBucket}:${AlignmentOutcome}`;

const FOLLOW_UP_TEMPLATES: Record<FollowUpKey, (ctx: { firstName: string; signOff: string }) => string> = {
  'early:over_projecting': ({ firstName, signOff }) => `Hi ${firstName},

Thanks for the time today. Before we go further on commercial pieces, I'd like to step back and re-anchor on whether there's a problem worth solving here — I don't think I asked enough on that front.

Could we grab 20 minutes next week? I'd rather ask the right questions now than send another proposal that misses.

${signOff}`,
  'early:aligned': ({ firstName, signOff }) => `Hi ${firstName},

Thanks for the time today. To make the next conversation more concrete, I'll put together a short brief on the impact pattern we discussed — and a couple of customer stories where the same shape played out.

Could we get 20 minutes on the calendar in the next week or two to walk through it together?

${signOff}`,
  'early:under_projecting': ({ firstName, signOff }) => `Hi ${firstName},

Thanks for today. Sounds like there's more momentum on your side than I had captured — appreciate you being direct about it.

I'll get the next-step materials over by end of week so you and your team can pressure-test them. When's a good window to compare notes after you've had a chance to look?

${signOff}`,
  'mid:over_projecting': ({ firstName, signOff }) => `Hi ${firstName},

Thanks for the time today. Before we keep moving on commercial details, I want to make sure we've validated the things that actually decide this internally for you.

Could we get 25 minutes with the people who'd need to be bought in before any next step? Happy to come prepared with the framing rather than the pitch.

${signOff}`,
  'mid:aligned': ({ firstName, signOff }) => `Hi ${firstName},

Thanks for today — felt like the right shape of conversation. I'll send over the artifact we discussed so you have something to socialize internally.

What would make the next conversation most useful for you? Happy to tailor it around whoever you want to bring in.

${signOff}`,
  'mid:under_projecting': ({ firstName, signOff }) => `Hi ${firstName},

Thanks for the time today. Reading the room, the next move is more concrete than I had planned for — that's a good problem to have.

I'll put together the materials your team would want to see before deciding and slot a follow-up. What's the right next step on your side, and who else should be in the conversation?

${signOff}`,
  'late:over_projecting': ({ firstName, signOff }) => `Hi ${firstName},

Thanks for the time today. Want to be straight with you — based on where we are, I think it's worth pausing the commercial track and reconfirming the decision criteria before we put paper on the table.

Could we get 20 minutes with whoever signs off, just to make sure we don't surprise each other downstream?

${signOff}`,
  'late:aligned': ({ firstName, signOff }) => `Hi ${firstName},

Thanks for the time — ready to move. I'll have paper across this week with the terms we discussed and a kickoff plan attached so your team can see what week one looks like.

Anything you'd want to confirm or change before that goes out?

${signOff}`,
  'late:under_projecting': ({ firstName, signOff }) => `Hi ${firstName},

Thanks for the time today. Honestly, this is closer to ready than I had it tracked — that's on me, and good news for the timeline.

I'll have paper and an implementation outline over by end of week. Let me know who else should be copied so nothing gets stuck on internal routing.

${signOff}`,
};

function deriveCoachingNote(
  opportunity: MockOpportunity,
  readinessState: ReadinessState,
  outcome: AlignmentOutcome,
  level: AlignmentLevel,
): string {
  if (outcome === 'over_projecting' && (level === 'critical' || level === 'high')) {
    return `${opportunity.opportunityName} is in ${opportunity.currentCrmStage} but the buyer is only at ${humanize(readinessState)}. Coach the rep to pull this back to a qualification call before any further commercial work — this is a forecast risk.`;
  }
  if (outcome === 'under_projecting') {
    return `${opportunity.opportunityName} is being under-called. The buyer is further along than the CRM stage shows. Coach the rep to advance the stage and accelerate the next step.`;
  }
  return `${opportunity.opportunityName} is on track. Coach the rep to focus on the recommended next action.`;
}

function humanize(value: string): string {
  return value.replace(/_/g, ' ');
}

// Re-exported for the diagnosis-running animation to enumerate stages.
export const FAKE_DIAGNOSIS_STEPS = [
  'Extracting signals from evidence…',
  'Scoring readiness dimensions…',
  'Running pipeline reality check…',
  'Generating recommended actions…',
] as const;

// Expose for any downstream code that wants the stage list directly.
export { SIMPLE_B2B_SALES_STAGES };
