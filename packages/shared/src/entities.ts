import { z } from 'zod';
import {
  activityTypeSchema,
  alignmentLevelSchema,
  alignmentOutcomeSchema,
  closedStatusSchema,
  crmStageTemplateSchema,
  crmTypeSchema,
  readinessStateSchema,
  subscriptionStatusSchema,
} from './enums';

// Core domain entities — the SHARED CONTRACT the mock store mirrors today and
// the real tRPC/Drizzle layer will satisfy later. IDs and timestamps are typed
// as plain strings here: the mock store issues string ids + ISO strings, the
// future DB issues uuids + Date objects, and both parse against these schemas.

const customCrmStageSchema = z.object({
  name: z.string(),
  order: z.number().int(),
});

// Workspaces own the pipeline configuration (CRM stages). MVP enforces one
// workspace per user.
export const workspaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  website: z.string().nullable(),
  industry: z.string().nullable(),
  crmStageTemplate: crmStageTemplateSchema,
  customCrmStages: z.array(customCrmStageSchema).nullable(),
  // Which CRM the workspace round-trips against (drives import/export guidance).
  crmType: crmTypeSchema.nullable(),
  // Paywall state — gates in-shell routes (M11).
  subscriptionStatus: subscriptionStatusSchema,
  createdByUserId: z.string(),
  onboardingCompleted: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Workspace = z.infer<typeof workspaceSchema>;

// Products are 1:N to a workspace, with exactly one `isPrimary` — the primary is
// the default product context for new opportunities (M9/M16).
export const productSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  name: z.string(),
  description: z.string(),
  targetBuyer: z.string(),
  problemSolved: z.string(),
  isPrimary: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Product = z.infer<typeof productSchema>;

// A buyer is a person at a company — first-class and separate from opportunity,
// so the same buyer can carry many opportunities (current, historical, reframed).
export const buyerSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  firstName: z.string(),
  lastName: z.string().nullable(),
  title: z.string().nullable(),
  company: z.string(),
  email: z.string().nullable(),
  linkedin: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Buyer = z.infer<typeof buyerSchema>;

// An opportunity is a unique buyer + product + deal-context combination.
export const opportunitySchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  buyerId: z.string(),
  productId: z.string(),
  ownerUserId: z.string(),
  opportunityName: z.string(),
  currentCrmStage: z.string(),
  opportunityValue: z.number().nullable(),
  expectedCloseDate: z.string().nullable(),
  knownPain: z.string().nullable(),
  knownObjection: z.string().nullable(),
  dealNotes: z.string().nullable(),
  // CRM record identifier (HubSpot Record ID / Pipedrive System ID). Drives the
  // two-tier export model (CRM note vs. Copy-only) and bulk-activity auto-join.
  crmRecordId: z.string().nullable(),
  // Denormalized from the latest diagnosis for cheap list-view rendering.
  currentReadinessState: readinessStateSchema.nullable(),
  currentReadinessScore: z.number().int().nullable(),
  currentAlignmentOutcome: alignmentOutcomeSchema.nullable(),
  currentAlignmentLevel: alignmentLevelSchema.nullable(),
  // Denormalized convenience flag, kept until M12/M17 read the `at_risk` state.
  atRisk: z.boolean(),
  closedStatus: closedStatusSchema,
  reframedFromOpportunityId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Opportunity = z.infer<typeof opportunitySchema>;

// An activity = one buyer interaction added to an opportunity (transcript /
// notes / checklist). Renamed from "interaction" / "evidence" in the re-scope.
export const activitySchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  opportunityId: z.string(),
  activityType: activityTypeSchema,
  activityDate: z.string(),
  participants: z.array(z.string()),
  transcriptOrNotes: z.string().nullable(),
  repSubjectiveNotes: z.string().nullable(),
  nextStepAgreed: z.boolean(),
  stakeholderAdded: z.boolean(),
  pricingDiscussed: z.boolean(),
  budgetDiscussed: z.boolean(),
  competitorDiscussed: z.boolean(),
  implementationDiscussed: z.boolean(),
  securityDiscussed: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Activity = z.infer<typeof activitySchema>;

// A reusable, workspace-level call-script template (managed on the M16 Scripts
// page). Distinct from a generated, per-opportunity script — see precall.ts.
export const scriptTemplateSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  name: z.string(),
  isPrimary: z.boolean(),
  content: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ScriptTemplate = z.infer<typeof scriptTemplateSchema>;

// A saved, reusable column-mapping config for the Daily Workbench import (M14).
export const importMappingFieldSchema = z.object({
  sourceColumn: z.string(),
  targetField: z.string().nullable(),
});
export type ImportMappingField = z.infer<typeof importMappingFieldSchema>;

export const importMappingSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  name: z.string(),
  crmType: crmTypeSchema.nullable(),
  fields: z.array(importMappingFieldSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ImportMapping = z.infer<typeof importMappingSchema>;
