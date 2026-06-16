import { describe, expect, it } from 'vitest';
import type { ReadinessDiagnosis, SignalExtraction } from '@pg/shared';
import {
  buildUserMessage,
  checkHardRules,
  mergeSignals,
  type DiagnosisGeneratorInput,
  type PriorDiagnosisContext,
} from './diagnosis-generator';

function emptySignals(): SignalExtraction {
  return {
    pain: [],
    trust: [],
    urgency: [],
    solution_confidence: [],
    commitment: [],
    risk: [],
    missing_evidence: [],
  };
}

function baseInput(over: Partial<DiagnosisGeneratorInput> = {}): DiagnosisGeneratorInput {
  return {
    productName: 'Acme CDP',
    productDescription: 'A customer data platform',
    targetBuyer: 'RevOps leaders',
    problemSolved: 'Fragmented customer data',
    opportunityName: 'Acme renewal',
    buyerCompany: 'Acme',
    currentCrmStage: 'Negotiation',
    knownPain: null,
    knownObjection: null,
    signals: emptySignals(),
    priorReadinessState: null,
    priorDiagnosis: null,
    recentSignals: [],
    commercialEvidence: false,
    ...over,
  };
}

const PRIOR: PriorDiagnosisContext = {
  readinessState: 'commit_ready',
  readinessScore: 88,
  confidenceLevel: 'high',
  primaryBlocker: 'Final legal sign-off',
  secondaryBlocker: null,
  alignmentOutcome: 'aligned',
  recommendedNextAction: 'Send the order form',
  dimensions: [{ dimension: 'commitment', score: 90, diagnosis: 'Verbal yes from the VP' }],
  diagnosedAt: '2026-06-01T00:00:00.000Z',
};

function diagnosisWithState(state: ReadinessDiagnosis['readiness_state']): ReadinessDiagnosis {
  return {
    readiness_state: state,
    readiness_score: 80,
    confidence_level: 'medium',
    dimension_scores: [],
    primary_blocker: null,
    secondary_blocker: null,
    pipeline_reality_check: {
      crm_stage: 'Negotiation',
      readiness_state: state,
      outcome: 'aligned',
      level: 'none',
      reason: 'x',
    },
    recommended_next_action: 'x',
    what_not_to_do_yet: [],
    follow_up_email: { subject: 's', body: 'b' },
    manager_coaching_note: 'n',
  } as ReadinessDiagnosis;
}

describe('buildUserMessage', () => {
  it('includes the prior diagnosis block and recent signals when present', () => {
    const recent = emptySignals();
    recent.commitment.push({
      signal: 'VP committed',
      evidence: 'We are in.',
      source: 'transcript',
      strength: 'strong',
      dimension: 'commitment',
    });
    const msg = buildUserMessage(
      baseInput({
        priorReadinessState: 'commit_ready',
        priorDiagnosis: PRIOR,
        recentSignals: [recent],
      }),
    );
    expect(msg).toContain('Prior diagnosis (the accumulated picture');
    expect(msg).toContain('commit_ready');
    expect(msg).toContain('Recent activity signals');
    expect(msg).toContain('New activity signals');
  });

  it('omits the history blocks on a first diagnosis', () => {
    const msg = buildUserMessage(baseInput());
    expect(msg).not.toContain('Prior diagnosis (the accumulated picture');
    expect(msg).not.toContain('Recent activity signals');
    expect(msg).toContain('(first diagnosis)');
  });
});

describe('checkHardRules — prior-state relaxation', () => {
  it('flags commit_ready with no commitment evidence and no prior commit state', () => {
    const violations = checkHardRules(
      diagnosisWithState('commit_ready'),
      emptySignals(),
      false,
      null,
    );
    expect(violations.some((v) => v.startsWith('Rule 1'))).toBe(true);
  });

  it('does NOT flag commit_ready when the prior diagnosis already established commitment', () => {
    const violations = checkHardRules(
      diagnosisWithState('commit_ready'),
      emptySignals(),
      false,
      'commit_ready',
    );
    expect(violations.some((v) => v.startsWith('Rule 1'))).toBe(false);
  });

  it('honors commitment evidence found anywhere in the cumulative window', () => {
    const withCommit = emptySignals();
    withCommit.commitment.push({
      signal: 'committed',
      evidence: 'yes',
      source: 'transcript',
      strength: 'strong',
      dimension: 'commitment',
    });
    const cumulative = mergeSignals([withCommit, emptySignals()]);
    const violations = checkHardRules(diagnosisWithState('commit_ready'), cumulative, false, null);
    expect(violations.some((v) => v.startsWith('Rule 1'))).toBe(false);
  });
});
