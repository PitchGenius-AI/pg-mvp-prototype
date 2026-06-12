import type { ReadinessState } from '@pg/shared';

// Display label + glance dot for each of the 9 readiness states (PG-291). Keyed by
// the full enum so a new state can't be added server-side without updating these
// (the Record type enforces exhaustiveness at typecheck). Colors run cool→warm
// with at-risk on the coral alert token, echoing the web workbench's readiness dot.
export const READINESS_LABEL: Record<ReadinessState, string> = {
  unaware: 'Unaware',
  problem_aware: 'Problem aware',
  diagnosis_aligned: 'Diagnosis aligned',
  solution_curious: 'Solution curious',
  solution_confident: 'Solution confident',
  stakeholder_validation_needed: 'Stakeholder validation',
  commercially_ready: 'Commercially ready',
  commit_ready: 'Commit ready',
  at_risk: 'At risk',
};

export const READINESS_DOT: Record<ReadinessState, string> = {
  unaware: 'rgba(255, 255, 255, 0.35)',
  problem_aware: '#8aa0d6',
  diagnosis_aligned: '#6fb5e8',
  solution_curious: '#5fc8d8',
  solution_confident: '#30f5fa',
  stakeholder_validation_needed: '#ffc861',
  commercially_ready: '#7fe0a0',
  commit_ready: '#5fe08a',
  at_risk: '#fc5e57',
};
