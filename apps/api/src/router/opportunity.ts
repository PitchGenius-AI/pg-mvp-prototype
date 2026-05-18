import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { buyers, opportunities, products, workspaces } from '@pg/db/schema';
import { protectedProcedure, router } from '../trpc';
import { TRPCError } from '@trpc/server';

// Helper — assert the user owns this workspace.
async function assertWorkspaceOwnership(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  workspaceId: string,
  userId: string,
) {
  const ws = await db.query.workspaces.findFirst({
    where: and(eq(workspaces.id, workspaceId), eq(workspaces.createdByUserId, userId)),
  });
  if (!ws) throw new TRPCError({ code: 'FORBIDDEN' });
  return ws;
}

export const opportunityRouter = router({
  list: protectedProcedure
    .input(z.object({ workspaceId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await assertWorkspaceOwnership(ctx.db, input.workspaceId, ctx.user.id);
      return ctx.db.query.opportunities.findMany({
        where: eq(opportunities.workspaceId, input.workspaceId),
        orderBy: [desc(opportunities.updatedAt)],
      });
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const opp = await ctx.db.query.opportunities.findFirst({
        where: eq(opportunities.id, input.id),
      });
      if (!opp) throw new TRPCError({ code: 'NOT_FOUND' });
      await assertWorkspaceOwnership(ctx.db, opp.workspaceId, ctx.user.id);
      return opp;
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
      await assertWorkspaceOwnership(ctx.db, input.workspaceId, ctx.user.id);
      // Resolve product (MVP enforces one per workspace).
      const product = await ctx.db.query.products.findFirst({
        where: eq(products.workspaceId, input.workspaceId),
      });
      if (!product) {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Complete onboarding first' });
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

        return opp;
      });
    }),
});
