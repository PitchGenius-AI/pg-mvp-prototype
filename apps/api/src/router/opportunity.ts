import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { buyers, opportunities, products } from '@pg/db/schema';
import { protectedProcedure, router } from '../trpc';
import { TRPCError } from '@trpc/server';
import { assertOpportunityAccess, assertWorkspaceAccess, resolveWorkspace } from '../lib/authz';
import { toWireOpportunity } from '../lib/serialize';

export const opportunityRouter = router({
  // Opportunities in the caller's workspace. workspaceId is optional — omitted,
  // it resolves to the caller's single workspace (MVP one-per-user).
  list: protectedProcedure
    .input(z.object({ workspaceId: z.string().uuid() }).optional())
    .query(async ({ ctx, input }) => {
      const ws = input ? await assertWorkspaceAccess(ctx, input.workspaceId) : await resolveWorkspace(ctx);
      const rows = await ctx.db.query.opportunities.findMany({
        where: eq(opportunities.workspaceId, ws.id),
        orderBy: [desc(opportunities.updatedAt)],
      });
      return rows.map(toWireOpportunity);
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return toWireOpportunity(await assertOpportunityAccess(ctx, input.id));
    }),

  // Creates a buyer (if not provided) + an opportunity in one tx.
  create: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        buyer: z
          .object({
            id: z.string().uuid().optional(),
            firstName: z.string().min(1),
            lastName: z.string().optional(),
            title: z.string().optional(),
            company: z.string().min(1),
            email: z.string().email().optional(),
            linkedin: z.string().url().optional(),
          })
          .refine((b) => b.id || (b.firstName && b.company), {
            message: 'Provide buyer.id or first_name + company',
          }),
        // Which product this opportunity is for. Optional — defaults to the
        // workspace's primary product (workspaces are 1:N to products with one
        // `isPrimary`, per the May-2026 re-scope).
        productId: z.string().uuid().optional(),
        opportunity: z.object({
          name: z.string().min(1),
          currentCrmStage: z.string().min(1),
          value: z.number().optional(),
          expectedCloseDate: z.string().optional(),
          knownPain: z.string().optional(),
          knownObjection: z.string().optional(),
          dealNotes: z.string().optional(),
        }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertWorkspaceAccess(ctx, input.workspaceId);
      // Resolve the product: explicit productId (validated against this
      // workspace), else the primary, else any product as a fallback.
      const product = input.productId
        ? await ctx.db.query.products.findFirst({
            where: and(
              eq(products.id, input.productId),
              eq(products.workspaceId, input.workspaceId),
            ),
          })
        : ((await ctx.db.query.products.findFirst({
            where: and(eq(products.workspaceId, input.workspaceId), eq(products.isPrimary, true)),
          })) ??
          (await ctx.db.query.products.findFirst({
            where: eq(products.workspaceId, input.workspaceId),
          })));
      if (!product) {
        throw new TRPCError({
          code: input.productId ? 'NOT_FOUND' : 'PRECONDITION_FAILED',
          message: input.productId
            ? 'Product not found in this workspace'
            : 'Complete onboarding first',
        });
      }

      return ctx.db.transaction(async (tx) => {
        let buyerId = input.buyer.id;
        if (!buyerId) {
          const [newBuyer] = await tx
            .insert(buyers)
            .values({
              workspaceId: input.workspaceId,
              firstName: input.buyer.firstName,
              lastName: input.buyer.lastName,
              title: input.buyer.title,
              company: input.buyer.company,
              email: input.buyer.email,
              linkedin: input.buyer.linkedin,
            })
            .returning();
          if (!newBuyer) throw new Error('Failed to create buyer');
          buyerId = newBuyer.id;
        }

        const [opp] = await tx
          .insert(opportunities)
          .values({
            workspaceId: input.workspaceId,
            buyerId,
            productId: product.id,
            ownerUserId: ctx.user.id,
            opportunityName: input.opportunity.name,
            currentCrmStage: input.opportunity.currentCrmStage,
            opportunityValue: input.opportunity.value?.toString(),
            expectedCloseDate: input.opportunity.expectedCloseDate,
            knownPain: input.opportunity.knownPain,
            knownObjection: input.opportunity.knownObjection,
            dealNotes: input.opportunity.dealNotes,
          })
          .returning();
        if (!opp) throw new Error('Failed to create opportunity');

        return toWireOpportunity(opp);
      });
    }),
});
