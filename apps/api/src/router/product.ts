import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { products } from '@pg/db/schema';
import { protectedProcedure, router } from '../trpc';
import { assertWorkspaceAccess, resolveWorkspace } from '../lib/authz';
import { toWireProduct } from '../lib/serialize';

export const productRouter = router({
  // Every product in the caller's workspace (multi-product as of M9), primary first.
  list: protectedProcedure.query(async ({ ctx }) => {
    const ws = await resolveWorkspace(ctx);
    const rows = await ctx.db.query.products.findMany({
      where: eq(products.workspaceId, ws.id),
      orderBy: [asc(products.createdAt)],
    });
    return rows.map(toWireProduct).sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));
  }),

  // A single product by id, scoped to the caller's workspace. Used by the desktop
  // Co-pilot to resolve the bound opportunity's product for planner pre-grounding
  // (PG-292), where only the productId is on hand.
  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const row = await ctx.db.query.products.findFirst({ where: eq(products.id, input.id) });
      if (!row) throw new TRPCError({ code: 'NOT_FOUND' });
      await assertWorkspaceAccess(ctx, row.workspaceId);
      return toWireProduct(row);
    }),
});
