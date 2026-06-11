import { eq } from 'drizzle-orm';
import { activities, buyers, opportunities, products, readinessDiagnoses } from '@pg/db/schema';
import { protectedProcedure, router } from '../trpc';
import { resolveWorkspace } from '../lib/authz';
import {
  toWireBuyer,
  toWireOpportunity,
  toWireProduct,
  type WireDiagnosis,
} from '../lib/serialize';

// The Opportunity Workbench read-model (M12) — each opportunity joined with its
// buyer, product, activity count + latest activity date, and the blocker +
// next-action from its most recent diagnosis. Assembled server-side so the board
// renders from one query instead of N+1 client fetches. Mirrors the shape the
// web previously built from the mock store (buildWorkbenchRows).
export const workbenchRouter = router({
  rows: protectedProcedure.query(async ({ ctx }) => {
    const ws = await resolveWorkspace(ctx);

    const [oppRows, buyerRows, productRows, activityRows, diagnosisRows] = await Promise.all([
      ctx.db.query.opportunities.findMany({ where: eq(opportunities.workspaceId, ws.id) }),
      ctx.db.query.buyers.findMany({ where: eq(buyers.workspaceId, ws.id) }),
      ctx.db.query.products.findMany({ where: eq(products.workspaceId, ws.id) }),
      ctx.db.query.activities.findMany({ where: eq(activities.workspaceId, ws.id) }),
      ctx.db.query.readinessDiagnoses.findMany({
        where: eq(readinessDiagnoses.workspaceId, ws.id),
      }),
    ]);

    const buyersById = new Map(buyerRows.map((b) => [b.id, toWireBuyer(b)]));
    const productsById = new Map(productRows.map((p) => [p.id, toWireProduct(p)]));

    const latestActivityByOpp = new Map<string, Date>();
    const activityCountByOpp = new Map<string, number>();
    for (const a of activityRows) {
      const prev = latestActivityByOpp.get(a.opportunityId);
      if (!prev || a.activityDate > prev) latestActivityByOpp.set(a.opportunityId, a.activityDate);
      activityCountByOpp.set(a.opportunityId, (activityCountByOpp.get(a.opportunityId) ?? 0) + 1);
    }

    const latestDxByOpp = new Map<string, (typeof diagnosisRows)[number]>();
    for (const d of diagnosisRows) {
      const prev = latestDxByOpp.get(d.opportunityId);
      if (!prev || d.createdAt > prev.createdAt) latestDxByOpp.set(d.opportunityId, d);
    }

    return oppRows.map((row) => {
      const opportunity = toWireOpportunity(row);
      const dx = latestDxByOpp.get(row.id);
      const latestActivity = latestActivityByOpp.get(row.id);
      const diagnosis = dx?.diagnosis as WireDiagnosis['diagnosis'] | undefined;
      return {
        opportunity,
        buyer: buyersById.get(row.buyerId) ?? null,
        product: productsById.get(row.productId) ?? null,
        latestActivityDate: (latestActivity ?? row.createdAt).toISOString(),
        lastActiveAt: opportunity.updatedAt,
        activityCount: activityCountByOpp.get(row.id) ?? 0,
        primaryBlocker: dx?.primaryBlocker ?? null,
        nextAction: diagnosis?.recommended_next_action ?? null,
      };
    });
  }),
});
