import { z } from 'zod';

// Single source of truth for enum values shared across DB, API, AI prompts, and UI.
// Keep in lockstep with packages/db/src/schema/enums.ts.

export const readinessStates = [
  'unaware',
  'problem_aware',
  'diagnosis_aligned',
  'solution_curious',
  'solution_confident',
  'stakeholder_validation_needed',
  'commercially_ready',
  'commit_ready',
] as const;
export const readinessStateSchema = z.enum(readinessStates);
export type ReadinessState = z.infer<typeof readinessStateSchema>;

export const alignmentOutcomes = ['over_projecting', 'aligned', 'under_projecting'] as const;
export const alignmentOutcomeSchema = z.enum(alignmentOutcomes);
export type AlignmentOutcome = z.infer<typeof alignmentOutcomeSchema>;

export const alignmentLevels = ['none', 'low', 'medium', 'high', 'critical'] as const;
export const alignmentLevelSchema = z.enum(alignmentLevels);
export type AlignmentLevel = z.infer<typeof alignmentLevelSchema>;

export const confidenceLevels = ['low', 'medium', 'high'] as const;
export const confidenceLevelSchema = z.enum(confidenceLevels);
export type ConfidenceLevel = z.infer<typeof confidenceLevelSchema>;

export const signalStrengths = ['weak', 'medium', 'strong'] as const;
export const signalStrengthSchema = z.enum(signalStrengths);
export type SignalStrength = z.infer<typeof signalStrengthSchema>;

export const signalDimensions = [
  'pain',
  'trust',
  'urgency',
  'solution_confidence',
  'commitment',
  'risk',
] as const;
export const signalDimensionSchema = z.enum(signalDimensions);
export type SignalDimension = z.infer<typeof signalDimensionSchema>;

export const signalSources = ['transcript', 'rep_note', 'checklist'] as const;
export const signalSourceSchema = z.enum(signalSources);
export type SignalSource = z.infer<typeof signalSourceSchema>;

export const interactionTypes = [
  'call',
  'video_meeting',
  'phone_call',
  'email_thread',
  'demo',
  'proposal_review',
  'other',
] as const;
export const interactionTypeSchema = z.enum(interactionTypes);
export type InteractionType = z.infer<typeof interactionTypeSchema>;

export const outcomeTypes = [
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
] as const;
export const outcomeTypeSchema = z.enum(outcomeTypes);
export type OutcomeType = z.infer<typeof outcomeTypeSchema>;

export const closedStatuses = ['open', 'closed_won', 'closed_lost', 'reframed'] as const;
export const closedStatusSchema = z.enum(closedStatuses);
export type ClosedStatus = z.infer<typeof closedStatusSchema>;
