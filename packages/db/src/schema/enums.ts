import { pgEnum } from 'drizzle-orm/pg-core';

// Buyer readiness states (At-Risk is a flag on opportunities, not a state).
export const readinessStateEnum = pgEnum('readiness_state', [
  'unaware',
  'problem_aware',
  'diagnosis_aligned',
  'solution_curious',
  'solution_confident',
  'stakeholder_validation_needed',
  'commercially_ready',
  'commit_ready',
]);

export const alignmentOutcomeEnum = pgEnum('alignment_outcome', [
  'over_projecting',
  'aligned',
  'under_projecting',
]);

export const alignmentLevelEnum = pgEnum('alignment_level', [
  'none',
  'low',
  'medium',
  'high',
  'critical',
]);

export const confidenceLevelEnum = pgEnum('confidence_level', ['low', 'medium', 'high']);

export const signalStrengthEnum = pgEnum('signal_strength', ['weak', 'medium', 'strong']);

export const signalDimensionEnum = pgEnum('signal_dimension', [
  'pain',
  'trust',
  'urgency',
  'solution_confidence',
  'commitment',
  'risk',
]);

export const signalSourceEnum = pgEnum('signal_source', ['transcript', 'rep_note', 'checklist']);

export const interactionTypeEnum = pgEnum('interaction_type', [
  'call',
  'video_meeting',
  'phone_call',
  'email_thread',
  'demo',
  'proposal_review',
  'other',
]);

export const outcomeTypeEnum = pgEnum('outcome_type', [
  'buyer_replied',
  'next_meeting_booked',
  'stakeholder_added',
  'pricing_requested',
  'security_procurement_requested',
  'deal_advanced',
  'deal_stalled',
  'buyer_went_dark',
  'closed_won',
  'closed_lost',
  'other',
]);

export const closedStatusEnum = pgEnum('closed_status', [
  'open',
  'closed_won',
  'closed_lost',
  'reframed',
]);

export const crmStageTemplateEnum = pgEnum('crm_stage_template', ['simple_b2b_sales', 'custom']);

export const intakeMethodEnum = pgEnum('intake_method', [
  'structured_form',
  'quick_paste',
  'csv_upload',
]);

export const exportTypeEnum = pgEnum('export_type', ['crm_note', 'csv', 'json']);

export const exportedObjectTypeEnum = pgEnum('exported_object_type', [
  'diagnosis',
  'opportunity',
  'opportunities_batch',
]);
