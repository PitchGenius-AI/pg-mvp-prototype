import type {
  ReadinessDiagnosis,
  SignalExtraction,
  ReadinessState,
  ConfidenceLevel,
  AlignmentOutcome,
  AlignmentLevel,
} from '@pg/shared';
import type { MockDiagnosis } from '../types';

let diagnosisCounter = 0;

export interface DiagnosisFactoryInput {
  id?: string;
  workspaceId: string;
  opportunityId: string;
  activityId: string;
  signalExtraction: SignalExtraction;
  diagnosis: ReadinessDiagnosis;
  createdAt?: string;
}

export function makeDiagnosis(input: DiagnosisFactoryInput): MockDiagnosis {
  diagnosisCounter += 1;
  const dx = input.diagnosis;
  return {
    id: input.id ?? `dx_seed_${diagnosisCounter}`,
    workspaceId: input.workspaceId,
    opportunityId: input.opportunityId,
    activityId: input.activityId,
    signalExtraction: input.signalExtraction,
    diagnosis: dx,
    readinessState: dx.readiness_state,
    readinessScore: dx.readiness_score,
    confidenceLevel: dx.confidence_level,
    alignmentOutcome: dx.pipeline_reality_check.outcome,
    alignmentLevel: dx.pipeline_reality_check.level,
    alignmentReason: dx.pipeline_reality_check.reason,
    primaryBlocker: dx.primary_blocker,
    secondaryBlocker: dx.secondary_blocker,
    crmNoteText: buildCrmNote(dx),
    followUpSubject: dx.follow_up_email.subject,
    followUpBody: dx.follow_up_email.body,
    managerCoachingNote: dx.manager_coaching_note,
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
}

// Compact paste-into-CRM summary derived from the structured diagnosis.
function buildCrmNote(dx: ReadinessDiagnosis): string {
  const blockerLine = dx.primary_blocker ? `Primary blocker: ${dx.primary_blocker}` : null;
  const alignmentLine = `Pipeline alignment: ${dx.pipeline_reality_check.outcome.replace(
    /_/g,
    ' ',
  )} (${dx.pipeline_reality_check.level}) — ${dx.pipeline_reality_check.reason}`;
  return [
    `Readiness: ${dx.readiness_state.replace(/_/g, ' ')} (${dx.readiness_score}/100, ${dx.confidence_level} confidence)`,
    alignmentLine,
    blockerLine,
    `Next action: ${dx.recommended_next_action}`,
  ]
    .filter((l): l is string => l != null)
    .join('\n');
}

// Convenience to build a single dimension score entry while keeping callsites short.
export interface DimensionInput {
  dimension: 'pain' | 'trust' | 'urgency' | 'solution_confidence' | 'commitment';
  score: number;
  diagnosis: string;
  evidence: string[];
}

export function dim(
  dimension: DimensionInput['dimension'],
  score: number,
  diagnosis: string,
  evidence: string[],
): ReadinessDiagnosis['dimension_scores'][number] {
  return { dimension, score, diagnosis, evidence };
}

// Build a diagnosis object with sensible defaults; caller supplies the meaningful fields.
export function buildDiagnosis(args: {
  readinessState: ReadinessState;
  readinessScore: number;
  confidence: ConfidenceLevel;
  dimensionScores: ReadinessDiagnosis['dimension_scores'];
  primaryBlocker: string | null;
  secondaryBlocker?: string | null;
  pipelineRealityCheck: {
    crmStage: string;
    outcome: AlignmentOutcome;
    level: AlignmentLevel;
    reason: string;
  };
  recommendedNextAction: string;
  whatNotToDoYet: string[];
  followUpSubject: string;
  followUpBody: string;
  managerCoachingNote: string;
}): ReadinessDiagnosis {
  return {
    readiness_state: args.readinessState,
    readiness_score: args.readinessScore,
    confidence_level: args.confidence,
    dimension_scores: args.dimensionScores,
    primary_blocker: args.primaryBlocker,
    secondary_blocker: args.secondaryBlocker ?? null,
    pipeline_reality_check: {
      crm_stage: args.pipelineRealityCheck.crmStage,
      readiness_state: args.readinessState,
      outcome: args.pipelineRealityCheck.outcome,
      level: args.pipelineRealityCheck.level,
      reason: args.pipelineRealityCheck.reason,
    },
    recommended_next_action: args.recommendedNextAction,
    what_not_to_do_yet: args.whatNotToDoYet,
    follow_up_email: {
      subject: args.followUpSubject,
      body: args.followUpBody,
    },
    manager_coaching_note: args.managerCoachingNote,
  };
}
