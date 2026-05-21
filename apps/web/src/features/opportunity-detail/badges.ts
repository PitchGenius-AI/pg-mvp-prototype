import type { ConfidenceLevel, ReadinessState } from '@pg/shared';
import { computeProvisionalReadiness } from '../../mock/fake-diagnosis';
import type { MockDiagnosis, MockOpportunity } from '../../mock/types';

// Shared inline color mappings + view-model helpers for the detail surfaces.
// M7 (skipped) would have replaced these with semantic tokens — for now we
// mirror the per-feature inline pattern the workbench (M12) uses.

export function alignmentColor(
  outcome: string | null | undefined,
  level: string | null | undefined,
): string {
  if (outcome === 'over_projecting') {
    if (level === 'critical' || level === 'high') return 'red';
    if (level === 'medium') return 'orange';
    return 'yellow';
  }
  if (outcome === 'under_projecting') return 'blue';
  if (outcome === 'aligned') return 'teal';
  return 'gray';
}

export function severityFromAlignment(
  outcome: string | null | undefined,
  level: string | null | undefined,
): 'high' | 'medium' | 'low' | 'none' {
  if (outcome === 'over_projecting') {
    if (level === 'critical' || level === 'high') return 'high';
    if (level === 'medium') return 'medium';
    return 'low';
  }
  if (outcome === 'under_projecting') {
    if (level === 'high' || level === 'critical') return 'medium';
    return 'low';
  }
  return 'none';
}

export function confidenceColor(level: string): string {
  if (level === 'high') return 'teal';
  if (level === 'medium') return 'yellow';
  return 'orange';
}

// Score → traffic-light color, matching the workbench + diagnosis dimension bars.
export function scoreColor(score: number): string {
  if (score >= 70) return 'teal';
  if (score >= 40) return 'yellow';
  return 'red';
}

export function humanize(value: string): string {
  return value.replace(/_/g, ' ');
}

// Human-readable readiness labels — kept in lockstep with the workbench's
// READINESS_LABELS (workbench-data.ts). `at_risk` reads as a regression.
export const READINESS_LABELS: Record<ReadinessState, string> = {
  unaware: 'Unaware',
  problem_aware: 'Problem aware',
  diagnosis_aligned: 'Diagnosis aligned',
  solution_curious: 'Solution curious',
  solution_confident: 'Solution confident',
  stakeholder_validation_needed: 'Stakeholder validation',
  commercially_ready: 'Commercially ready',
  commit_ready: 'Commit ready',
  at_risk: 'At risk / regressed',
};

// `at_risk` is the only readiness state that carries a color — it's the one a
// rep needs to catch at a glance.
export function readinessColor(state: ReadinessState | null | undefined): string {
  return state === 'at_risk' ? 'red' : 'gray';
}

// The readiness the persistent score header + tabs render. A diagnosed deal
// reads straight off its latest diagnosis; an activity-less deal gets a
// provisional, low-confidence read derived from its CRM stage (M17, PG-225) so
// the hero score never renders empty.
export interface ReadinessVm {
  state: ReadinessState;
  score: number;
  isProvisional: boolean;
  confidence: ConfidenceLevel | null;
}

export function deriveReadinessVm(
  opportunity: MockOpportunity,
  latestDiagnosis: MockDiagnosis | null,
): ReadinessVm {
  if (latestDiagnosis) {
    return {
      state: latestDiagnosis.readinessState,
      score: latestDiagnosis.readinessScore,
      isProvisional: false,
      confidence: latestDiagnosis.confidenceLevel,
    };
  }
  const provisional = computeProvisionalReadiness(opportunity.currentCrmStage);
  return { ...provisional, isProvisional: true, confidence: null };
}
