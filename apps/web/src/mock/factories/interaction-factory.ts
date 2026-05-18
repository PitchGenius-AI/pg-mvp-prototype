import type { MockInteraction } from '../types';

let interactionCounter = 0;

export interface InteractionFactoryInput
  extends Omit<MockInteraction, 'id' | 'createdAt' | 'updatedAt'> {
  id?: string;
  createdAt?: string;
  updatedAt?: string;
}

export function makeInteraction(input: InteractionFactoryInput): MockInteraction {
  interactionCounter += 1;
  const now = new Date().toISOString();
  return {
    id: input.id ?? `int_seed_${interactionCounter}`,
    workspaceId: input.workspaceId,
    opportunityId: input.opportunityId,
    interactionType: input.interactionType,
    interactionDate: input.interactionDate,
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
