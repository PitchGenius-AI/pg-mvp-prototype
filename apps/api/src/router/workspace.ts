import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { onboarding, products, workspaces } from '@pg/db/schema';
import { protectedProcedure, router } from '../trpc';

export const workspaceRouter = router({
  // Returns the user's workspace + product + onboarding status, or null if not yet created.
  getCurrent: protectedProcedure.query(async ({ ctx }) => {
    const ws = await ctx.db.query.workspaces.findFirst({
      where: eq(workspaces.createdByUserId, ctx.user.id),
    });
    if (!ws) return null;

    const [product, onboardingRow] = await Promise.all([
      ctx.db.query.products.findFirst({ where: eq(products.workspaceId, ws.id) }),
      ctx.db.query.onboarding.findFirst({ where: eq(onboarding.workspaceId, ws.id) }),
    ]);

    return { workspace: ws, product: product ?? null, onboarding: onboardingRow ?? null };
  }),

  // Atomically creates workspace + product + marks onboarding complete.
  completeOnboarding: protectedProcedure
    .input(
      z.object({
        workspaceName: z.string().min(1),
        product: z.object({
          name: z.string().min(1),
          description: z.string().min(1),
          targetBuyer: z.string().min(1),
          problemSolved: z.string().min(1),
        }),
        crmStageTemplate: z.enum(['simple_b2b_sales', 'custom']),
        customStages: z
          .array(z.object({ name: z.string().min(1), order: z.number().int() }))
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.transaction(async (tx) => {
        const [ws] = await tx
          .insert(workspaces)
          .values({
            name: input.workspaceName,
            crmStageTemplate: input.crmStageTemplate,
            customCrmStages: input.customStages,
            createdByUserId: ctx.user.id,
          })
          .returning();
        if (!ws) throw new Error('Failed to create workspace');

        const [product] = await tx
          .insert(products)
          .values({
            workspaceId: ws.id,
            ...input.product,
          })
          .returning();

        await tx.insert(onboarding).values({
          workspaceId: ws.id,
          completed: true,
          completedAt: new Date(),
        });

        return { workspace: ws, product };
      });
    }),
});
