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

const undef = (v: string | null) => (v && v.trim().length > 0 ? v : undefined);

// Build the input for the real `opportunity.create` mutation. The buyer carries
// its details either way (firstName + company are required); when linking, it
// also carries the existing buyer's id so the server reuses it.
export function buildAddOpportunityArgs(
  draft: PreSaveOpportunity,
  ctx: SaveContext,
  strategy: BuyerStrategy,
) {
  return {
    workspaceId: ctx.workspaceId,
    productId: ctx.productId,
    buyer: {
      id: strategy.kind === 'link' ? strategy.buyerId : undefined,
      firstName: draft.buyer.firstName,
      lastName: undef(draft.buyer.lastName),
      title: undef(draft.buyer.title),
      company: draft.buyer.company,
      email: undef(draft.buyer.email),
      linkedin: undef(draft.buyer.linkedin),
    },
    opportunity: {
      name: draft.opportunity.opportunityName,
      currentCrmStage: draft.opportunity.currentCrmStage,
      value: draft.opportunity.opportunityValue ?? undefined,
      expectedCloseDate: undef(draft.opportunity.expectedCloseDate),
      knownPain: undef(draft.opportunity.knownPain),
      knownObjection: undef(draft.opportunity.knownObjection),
      dealNotes: undef(draft.opportunity.dealNotes),
    },
  };
}
