import { findMatchingBuyer } from '../../mock/store';
import type { MockBuyer } from '../../mock/types';

// Shared shape the single-opportunity intake methods (Structured form, Paste)
// produce before commit — lets dedup + save logic stay identical across both.

export interface PreSaveBuyer {
  firstName: string;
  lastName: string | null;
  title: string | null;
  company: string;
  email: string | null;
  linkedin: string | null;
  website: string | null;
}

export interface PreSaveOpportunity {
  buyer: PreSaveBuyer;
  opportunity: {
    opportunityName: string;
    currentCrmStage: string;
    opportunityValue: number | null;
    expectedCloseDate: string | null;
    knownPain: string | null;
    knownObjection: string | null;
    dealNotes: string | null;
  };
}

export interface SaveContext {
  workspaceId: string;
  ownerUserId: string;
  // Always set for the single-opportunity methods — the product is chosen on the
  // form (defaulted to primary) and never deferred (PG-210).
  productId: string;
}

export type BuyerStrategy = { kind: 'create' } | { kind: 'link'; buyerId: string };

// Returns a matching buyer in the workspace (email, or first-name + company) so
// the caller can offer "link to existing buyer?" before creating a duplicate.
export function checkDedup(
  workspaceId: string,
  draft: PreSaveOpportunity,
): MockBuyer | null {
  return findMatchingBuyer(workspaceId, {
    firstName: draft.buyer.firstName,
    company: draft.buyer.company,
    email: draft.buyer.email,
  });
}

// Build the argument for the `useAddOpportunity` mutation — a new buyer when
// creating, or just the linked buyerId when linking to an existing one.
export function buildAddOpportunityArgs(
  draft: PreSaveOpportunity,
  ctx: SaveContext,
  strategy: BuyerStrategy,
) {
  const opportunity = {
    workspaceId: ctx.workspaceId,
    ownerUserId: ctx.ownerUserId,
    productId: ctx.productId,
    buyerId: strategy.kind === 'link' ? strategy.buyerId : undefined,
    opportunityName: draft.opportunity.opportunityName,
    currentCrmStage: draft.opportunity.currentCrmStage,
    opportunityValue: draft.opportunity.opportunityValue,
    expectedCloseDate: draft.opportunity.expectedCloseDate,
    knownPain: draft.opportunity.knownPain,
    knownObjection: draft.opportunity.knownObjection,
    dealNotes: draft.opportunity.dealNotes,
  };
  const buyer =
    strategy.kind === 'create'
      ? {
          workspaceId: ctx.workspaceId,
          firstName: draft.buyer.firstName,
          lastName: draft.buyer.lastName,
          title: draft.buyer.title,
          company: draft.buyer.company,
          email: draft.buyer.email,
          linkedin: draft.buyer.linkedin,
          website: draft.buyer.website,
          notes: null,
        }
      : undefined;
  return { buyer, opportunity };
}
