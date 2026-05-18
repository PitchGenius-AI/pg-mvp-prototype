import { findMatchingBuyer, mockActions, useMockStore } from '../../mock/store';
import type { MockBuyer, MockOpportunity } from '../../mock/types';

// Shape that all three intake methods produce before commit. Lets dedup + save
// logic be shared across structured form, quick paste, and CSV.
export interface PreSaveOpportunity {
  buyer: {
    firstName: string;
    lastName: string | null;
    title: string | null;
    company: string;
    email: string | null;
    linkedin: string | null;
  };
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
  productId: string;
}

export interface SaveResult {
  buyer: MockBuyer;
  opportunity: MockOpportunity;
}

// Commit without any dedup check (caller has already decided what to do).
export function commitOpportunity(
  draft: PreSaveOpportunity,
  ctx: SaveContext,
  buyerStrategy: { kind: 'create' } | { kind: 'link'; buyerId: string },
): SaveResult {
  const buyer =
    buyerStrategy.kind === 'link'
      ? requireBuyer(buyerStrategy.buyerId)
      : mockActions.addBuyer({
          ...draft.buyer,
          workspaceId: ctx.workspaceId,
          notes: null,
        });

  const opportunity = mockActions.addOpportunity({
    workspaceId: ctx.workspaceId,
    buyerId: buyer.id,
    productId: ctx.productId,
    ownerUserId: ctx.ownerUserId,
    ...draft.opportunity,
  });

  return { buyer, opportunity };
}

function requireBuyer(buyerId: string): MockBuyer {
  const buyer = useMockStore.getState().buyers[buyerId];
  if (!buyer) throw new Error(`Buyer ${buyerId} not found`);
  return buyer;
}

// Returns a matching buyer for the draft if one exists in the workspace, or null.
export function checkDedup(workspaceId: string, draft: PreSaveOpportunity): MockBuyer | null {
  return findMatchingBuyer(workspaceId, {
    firstName: draft.buyer.firstName,
    company: draft.buyer.company,
    email: draft.buyer.email,
  });
}
