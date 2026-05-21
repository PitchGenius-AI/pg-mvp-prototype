import { z } from 'zod';

// Single source of truth for enum values shared across DB, API, AI prompts, and UI.
// Keep in lockstep with packages/db/src/schema/enums.ts.

// 9 readiness states (May-2026 re-scope). `at_risk` is the regression state —
// it was a separate boolean on opportunities in the M1–M8 model and is now a
// first-class state (see CLAUDE.md → Scope status). The denormalized `atRisk`
// boolean is retained on the opportunity as a convenience until the workbench
// (M12) and detail (M17) surfaces are rebuilt to read the state directly.
export const readinessStates = [
  'unaware',
  'problem_aware',
  'diagnosis_aligned',
  'solution_curious',
  'solution_confident',
  'stakeholder_validation_needed',
  'commercially_ready',
  'commit_ready',
  'at_risk',
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

// An "activity" is what a rep adds to an opportunity from a buyer interaction
// (transcript / notes / checklist). Earlier drafts called this "evidence" /
// "interaction" — renamed throughout in the May-2026 re-scope.
export const activityTypes = [
  'call',
  'video_meeting',
  'phone_call',
  'email_thread',
  'demo',
  'proposal_review',
  'other',
] as const;
export const activityTypeSchema = z.enum(activityTypes);
export type ActivityType = z.infer<typeof activityTypeSchema>;

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

export const crmStageTemplates = ['simple_b2b_sales', 'custom'] as const;
export const crmStageTemplateSchema = z.enum(crmStageTemplates);
export type CrmStageTemplate = z.infer<typeof crmStageTemplateSchema>;

// The CRMs the file-based round-trip targets (HubSpot + Pipedrive only — see
// CLAUDE.md → "What's intentionally NOT here" on Salesforce).
export const crmTypes = ['hubspot', 'pipedrive'] as const;
export const crmTypeSchema = z.enum(crmTypes);
export type CrmType = z.infer<typeof crmTypeSchema>;

// Subscription / paywall state. The hard paywall (M11) gates in-shell routes
// to workspaces whose status is `trialing` or `active`.
export const subscriptionStatuses = [
  'none',
  'trialing',
  'active',
  'past_due',
  'canceled',
] as const;
export const subscriptionStatusSchema = z.enum(subscriptionStatuses);
export type SubscriptionStatus = z.infer<typeof subscriptionStatusSchema>;

// Sales techniques the pre-call intelligence matches a buyer to.
export const salesTechniques = ['challenger', 'spin', 'nepq'] as const;
export const salesTechniqueSchema = z.enum(salesTechniques);
export type SalesTechnique = z.infer<typeof salesTechniqueSchema>;

// DISC personality quadrants (Dominance / Influence / Steadiness / Conscientiousness).
export const discTypes = ['D', 'I', 'S', 'C'] as const;
export const discTypeSchema = z.enum(discTypes);
export type DiscType = z.infer<typeof discTypeSchema>;
