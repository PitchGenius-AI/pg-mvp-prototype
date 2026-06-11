import { asc, eq } from 'drizzle-orm';
import { products } from '@pg/db/schema';
import { protectedProcedure, router } from '../trpc';
import { resolveWorkspace } from '../lib/authz';
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
});
