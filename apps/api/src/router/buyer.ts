import { asc, eq } from 'drizzle-orm';
import { buyers, opportunities } from '@pg/db/schema';
import { protectedProcedure, router } from '../trpc';
import { resolveWorkspace } from '../lib/authz';
import { toWireBuyer } from '../lib/serialize';

export const buyerRouter = router({
  // Every buyer in the caller's workspace, sorted by first name. Carries no
  // readiness/alignment data — that's a deal concept (the Buyers directory, M13).
  list: protectedProcedure.query(async ({ ctx }) => {
    const ws = await resolveWorkspace(ctx);
    const rows = await ctx.db.query.buyers.findMany({
      where: eq(buyers.workspaceId, ws.id),
      orderBy: [asc(buyers.firstName)],
    });
    return rows.map(toWireBuyer);
  }),

  // The Buyers people-directory read-model (M13) — each buyer joined with its
  // opportunity count + assigned/unassigned status. A buyer with no opportunity
  // is "unassigned"; assigning a product turns it into an opportunity (PG-206/207).
  directory: protectedProcedure.query(async ({ ctx }) => {
    const ws = await resolveWorkspace(ctx);
    const [buyerRows, oppRows] = await Promise.all([
      ctx.db.query.buyers.findMany({
        where: eq(buyers.workspaceId, ws.id),
        orderBy: [asc(buyers.firstName)],
      }),
      ctx.db.query.opportunities.findMany({ where: eq(opportunities.workspaceId, ws.id) }),
    ]);
    const countByBuyer = new Map<string, number>();
    for (const o of oppRows) {
      countByBuyer.set(o.buyerId, (countByBuyer.get(o.buyerId) ?? 0) + 1);
    }
    return buyerRows.map((b) => {
      const opportunityCount = countByBuyer.get(b.id) ?? 0;
      return {
        buyer: toWireBuyer(b),
        opportunityCount,
        status: opportunityCount > 0 ? ('assigned' as const) : ('unassigned' as const),
      };
    });
  }),
});
