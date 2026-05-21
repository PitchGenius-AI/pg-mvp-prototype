import type { MockActivity } from '../types';

let activityCounter = 0;

export interface ActivityFactoryInput
  extends Omit<MockActivity, 'id' | 'createdAt' | 'updatedAt'> {
  id?: string;
  createdAt?: string;
  updatedAt?: string;
}

export function makeActivity(input: ActivityFactoryInput): MockActivity {
  activityCounter += 1;
  const now = new Date().toISOString();
  return {
    id: input.id ?? `act_seed_${activityCounter}`,
    workspaceId: input.workspaceId,
    opportunityId: input.opportunityId,
    activityType: input.activityType,
    activityDate: input.activityDate,
    participants: input.participants,
    transcriptOrNotes: input.transcriptOrNotes ?? null,
    repSubjectiveNotes: input.repSubjectiveNotes ?? null,
    nextStepAgreed: input.nextStepAgreed,
    stakeholderAdded: input.stakeholderAdded,
    pricingDiscussed: input.pricingDiscussed,
    budgetDiscussed: input.budgetDiscussed,
    competitorDiscussed: input.competitorDiscussed,
    implementationDiscussed: input.implementationDiscussed,
    securityDiscussed: input.securityDiscussed,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
  };
}
