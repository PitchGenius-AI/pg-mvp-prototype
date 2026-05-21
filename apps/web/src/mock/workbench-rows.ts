import { useMockStore } from './store';
import type { MockBuyer, MockDiagnosis, MockOpportunity, MockProduct } from './types';

// Denormalized read-model for the Opportunity Workbench (M12). One opportunity
// joined with its buyer, product, latest activity date, and the blocker +
// next-action from its most recent diagnosis — what a real `workbench.list`
// tRPC endpoint would return. Both Workbench views render this shape.
export interface WorkbenchRow {
  opportunity: MockOpportunity;
  buyer: MockBuyer | null;
  product: MockProduct | null;
  latestActivityDate: string;
  primaryBlocker: string | null;
  nextAction: string | null;
}

export function buildWorkbenchRows(workspaceId: string): WorkbenchRow[] {
  const state = useMockStore.getState();
  const opps = Object.values(state.opportunities).filter(
    (o) => o.workspaceId === workspaceId,
  );

  const latestActivityByOpp = new Map<string, string>();
  for (const a of Object.values(state.activities)) {
    const prev = latestActivityByOpp.get(a.opportunityId);
    if (!prev || a.activityDate > prev) {
      latestActivityByOpp.set(a.opportunityId, a.activityDate);
    }
  }

  const latestDxByOpp = new Map<string, MockDiagnosis>();
  for (const d of Object.values(state.diagnoses)) {
    const prev = latestDxByOpp.get(d.opportunityId);
    if (!prev || d.createdAt > prev.createdAt) {
      latestDxByOpp.set(d.opportunityId, d);
    }
  }

  return opps.map((opp) => {
    const dx = latestDxByOpp.get(opp.id) ?? null;
    return {
      opportunity: opp,
      buyer: state.buyers[opp.buyerId] ?? null,
      product: state.products[opp.productId] ?? null,
      latestActivityDate: latestActivityByOpp.get(opp.id) ?? opp.createdAt,
      primaryBlocker: dx?.primaryBlocker ?? null,
      nextAction: dx?.diagnosis.recommended_next_action ?? null,
    };
  });
}
