import { useMockStore } from './store';
import type { MockBuyer } from './types';

// Read-model for the Buyers people directory (M13). One buyer joined with a
// count of its opportunities and an assigned/unassigned status — what a real
// `buyer.directory` tRPC endpoint would return. The /buyers table renders this
// shape directly; it deliberately carries no readiness/alignment data (that is
// a deal concept, not a person concept — PG-205).
export type BuyerAssignmentStatus = 'assigned' | 'unassigned';

export interface BuyerRow {
  buyer: MockBuyer;
  // Total opportunities for this buyer (open, closed, or reframed alike).
  opportunityCount: number;
  // A buyer with no opportunity is "unassigned" — assigning a product turns it
  // into an opportunity (PG-206/207). This mirrors how the Workbench banner
  // computes its unassigned count, so the two surfaces never disagree.
  status: BuyerAssignmentStatus;
}

export function buildBuyerRows(workspaceId: string): BuyerRow[] {
  const state = useMockStore.getState();

  const countByBuyer = new Map<string, number>();
  for (const opp of Object.values(state.opportunities)) {
    if (opp.workspaceId !== workspaceId) continue;
    countByBuyer.set(opp.buyerId, (countByBuyer.get(opp.buyerId) ?? 0) + 1);
  }

  return Object.values(state.buyers)
    .filter((b) => b.workspaceId === workspaceId)
    .map((buyer) => {
      const opportunityCount = countByBuyer.get(buyer.id) ?? 0;
      return {
        buyer,
        opportunityCount,
        status: opportunityCount > 0 ? 'assigned' : 'unassigned',
      } satisfies BuyerRow;
    })
    .sort((a, b) => buyerSortKey(a.buyer).localeCompare(buyerSortKey(b.buyer)));
}

const buyerSortKey = (b: MockBuyer): string =>
  [b.firstName, b.lastName].filter(Boolean).join(' ').toLowerCase();
