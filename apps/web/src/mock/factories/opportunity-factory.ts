import type { MockOpportunity } from '../types';

let opportunityCounter = 0;

export interface OpportunityFactoryInput
  extends Omit<
    MockOpportunity,
    | 'id'
    | 'createdAt'
    | 'updatedAt'
    | 'currentReadinessState'
    | 'currentReadinessScore'
    | 'currentAlignmentOutcome'
    | 'currentAlignmentLevel'
    | 'closedStatus'
    | 'reframedFromOpportunityId'
    | 'atRisk'
  > {
  id?: string;
  atRisk?: boolean;
  closedStatus?: MockOpportunity['closedStatus'];
  createdAt?: string;
  updatedAt?: string;
  // Denormalized fields are normally written by runDiagnosis, but seed deals
  // come prepopulated so the list view has values immediately.
  currentReadinessState?: MockOpportunity['currentReadinessState'];
  currentReadinessScore?: MockOpportunity['currentReadinessScore'];
  currentAlignmentOutcome?: MockOpportunity['currentAlignmentOutcome'];
  currentAlignmentLevel?: MockOpportunity['currentAlignmentLevel'];
}

export function makeOpportunity(input: OpportunityFactoryInput): MockOpportunity {
  opportunityCounter += 1;
  const now = new Date().toISOString();
  return {
    id: input.id ?? `opp_seed_${opportunityCounter}`,
    workspaceId: input.workspaceId,
    buyerId: input.buyerId,
    productId: input.productId,
    ownerUserId: input.ownerUserId,
    opportunityName: input.opportunityName,
    currentCrmStage: input.currentCrmStage,
    opportunityValue: input.opportunityValue ?? null,
    expectedCloseDate: input.expectedCloseDate ?? null,
    knownPain: input.knownPain ?? null,
    knownObjection: input.knownObjection ?? null,
    dealNotes: input.dealNotes ?? null,
    currentReadinessState: input.currentReadinessState ?? null,
    currentReadinessScore: input.currentReadinessScore ?? null,
    currentAlignmentOutcome: input.currentAlignmentOutcome ?? null,
    currentAlignmentLevel: input.currentAlignmentLevel ?? null,
    atRisk: input.atRisk ?? false,
    closedStatus: input.closedStatus ?? 'open',
    reframedFromOpportunityId: null,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
  };
}
