import {
  activitySchema,
  buyerSchema,
  opportunitySchema,
  precallIntelligenceSchema,
  productSchema,
  workspaceSchema,
  type Activity,
  type Buyer,
  type Opportunity,
  type PrecallIntelligence,
  type Product,
  type Workspace,
} from '@pg/shared';
import type {
  activities,
  buyers,
  diagnosisJobs,
  opportunities,
  precallIntelligence,
  products,
  readinessDiagnoses,
  workspaces,
} from '@pg/db/schema';

// API output boundary. Drizzle returns Date for timestamps and string for
// numeric/date columns; the @pg/shared contract (which the whole web app is
// typed against) uses ISO strings for timestamps and number for
// opportunityValue. These mappers normalize every row to the shared wire shape
// and validate it via zod before it leaves a tRPC procedure — so the client
// receives exactly what @pg/shared promises, runtime and type alike.

type WorkspaceRow = typeof workspaces.$inferSelect;
type ProductRow = typeof products.$inferSelect;
type BuyerRow = typeof buyers.$inferSelect;
type OpportunityRow = typeof opportunities.$inferSelect;
type ActivityRow = typeof activities.$inferSelect;
type DiagnosisRow = typeof readinessDiagnoses.$inferSelect;
type DiagnosisJobRow = typeof diagnosisJobs.$inferSelect;
type PrecallRow = typeof precallIntelligence.$inferSelect;

const iso = (d: Date | string): string => (typeof d === 'string' ? d : d.toISOString());

export function toWireWorkspace(row: WorkspaceRow, onboardingCompleted: boolean): Workspace {
  return workspaceSchema.parse({
    id: row.id,
    name: row.name,
    website: row.website ?? null,
    industry: row.industry ?? null,
    crmStageTemplate: row.crmStageTemplate,
    customCrmStages: row.customCrmStages ?? null,
    crmType: row.crmType ?? null,
    subscriptionStatus: row.subscriptionStatus,
    createdByUserId: row.createdByUserId,
    onboardingCompleted,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  });
}

export function toWireProduct(row: ProductRow): Product {
  return productSchema.parse({
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    description: row.description,
    targetBuyer: row.targetBuyer,
    problemSolved: row.problemSolved,
    isPrimary: row.isPrimary,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  });
}

export function toWireBuyer(row: BuyerRow): Buyer {
  return buyerSchema.parse({
    id: row.id,
    workspaceId: row.workspaceId,
    firstName: row.firstName,
    lastName: row.lastName ?? null,
    title: row.title ?? null,
    company: row.company,
    email: row.email ?? null,
    linkedin: row.linkedin ?? null,
    website: row.website ?? null,
    notes: row.notes ?? null,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  });
}

export function toWireOpportunity(row: OpportunityRow): Opportunity {
  return opportunitySchema.parse({
    id: row.id,
    workspaceId: row.workspaceId,
    buyerId: row.buyerId,
    productId: row.productId,
    ownerUserId: row.ownerUserId,
    opportunityName: row.opportunityName,
    currentCrmStage: row.currentCrmStage,
    opportunityValue: row.opportunityValue == null ? null : Number(row.opportunityValue),
    expectedCloseDate: row.expectedCloseDate ?? null,
    knownPain: row.knownPain ?? null,
    knownObjection: row.knownObjection ?? null,
    dealNotes: row.dealNotes ?? null,
    crmRecordId: row.crmRecordId ?? null,
    currentReadinessState: row.currentReadinessState ?? null,
    currentReadinessScore: row.currentReadinessScore ?? null,
    currentAlignmentOutcome: row.currentAlignmentOutcome ?? null,
    currentAlignmentLevel: row.currentAlignmentLevel ?? null,
    atRisk: row.atRisk,
    closedStatus: row.closedStatus,
    reframedFromOpportunityId: row.reframedFromOpportunityId ?? null,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  });
}

export function toWireActivity(row: ActivityRow): Activity {
  return activitySchema.parse({
    id: row.id,
    workspaceId: row.workspaceId,
    opportunityId: row.opportunityId,
    activityType: row.activityType,
    activityDate: iso(row.activityDate),
    participants: row.participants ?? [],
    transcriptOrNotes: row.transcriptOrNotes ?? null,
    repSubjectiveNotes: row.repSubjectiveNotes ?? null,
    nextStepAgreed: row.nextStepAgreed,
    stakeholderAdded: row.stakeholderAdded,
    pricingDiscussed: row.pricingDiscussed,
    budgetDiscussed: row.budgetDiscussed,
    competitorDiscussed: row.competitorDiscussed,
    implementationDiscussed: row.implementationDiscussed,
    securityDiscussed: row.securityDiscussed,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  });
}

// The diagnosis wire shape mirrors the web's read-model: the validated AI output
// (typed jsonb) plus the denormalized columns. No @pg/shared row schema exists
// for it, so this is a structural mapper (the jsonb is already typed + was zod-
// validated on insert).
export interface WireDiagnosis {
  id: string;
  workspaceId: string;
  opportunityId: string;
  activityId: string;
  signalExtraction: DiagnosisRow['signalExtraction'];
  diagnosis: DiagnosisRow['diagnosis'];
  readinessState: DiagnosisRow['readinessState'];
  readinessScore: number;
  confidenceLevel: DiagnosisRow['confidenceLevel'];
  alignmentOutcome: DiagnosisRow['alignmentOutcome'];
  alignmentLevel: DiagnosisRow['alignmentLevel'];
  alignmentReason: string;
  primaryBlocker: string | null;
  secondaryBlocker: string | null;
  crmNoteText: string;
  followUpSubject: string | null;
  followUpBody: string | null;
  managerCoachingNote: string | null;
  createdAt: string;
}

// The async diagnosis run's lifecycle, for the UI poll. No @pg/shared schema (it's
// an infra read-model, like WireDiagnosis); the client types it via tRPC inference.
export interface WireDiagnosisJob {
  id: string;
  opportunityId: string;
  activityId: string;
  status: DiagnosisJobRow['status'];
  error: string | null;
  diagnosisId: string | null;
  createdAt: string;
  updatedAt: string;
}

export function toWireDiagnosisJob(row: DiagnosisJobRow): WireDiagnosisJob {
  return {
    id: row.id,
    opportunityId: row.opportunityId,
    activityId: row.activityId,
    status: row.status,
    error: row.error ?? null,
    diagnosisId: row.diagnosisId ?? null,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

export function toWirePrecall(row: PrecallRow): PrecallIntelligence {
  return precallIntelligenceSchema.parse({
    id: row.id,
    opportunityId: row.opportunityId,
    psychProfile: row.psychProfile,
    matchedTechnique: row.matchedTechnique,
    generatedScript: row.generatedScript,
    generatedAt: iso(row.generatedAt),
  });
}

export function toWireDiagnosis(row: DiagnosisRow): WireDiagnosis {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    opportunityId: row.opportunityId,
    activityId: row.activityId,
    signalExtraction: row.signalExtraction,
    diagnosis: row.diagnosis,
    readinessState: row.readinessState,
    readinessScore: row.readinessScore,
    confidenceLevel: row.confidenceLevel,
    alignmentOutcome: row.alignmentOutcome,
    alignmentLevel: row.alignmentLevel,
    alignmentReason: row.alignmentReason,
    primaryBlocker: row.primaryBlocker ?? null,
    secondaryBlocker: row.secondaryBlocker ?? null,
    crmNoteText: row.crmNoteText,
    followUpSubject: row.followUpSubject ?? null,
    followUpBody: row.followUpBody ?? null,
    managerCoachingNote: row.managerCoachingNote ?? null,
    createdAt: iso(row.createdAt),
  };
}
