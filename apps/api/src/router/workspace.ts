import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { crmTypeSchema } from '@pg/shared';
import { onboarding, products, scriptTemplates, workspaces } from '@pg/db/schema';
import { protectedProcedure, router } from '../trpc';
import { toWireProduct, toWireWorkspace } from '../lib/serialize';

export const workspaceRouter = router({
  // The caller's workspace (with onboardingCompleted folded in) + all products +
  // the primary product, or null if they haven't created a workspace yet. Backs
  // the web session/workspace/products hooks.
  getCurrent: protectedProcedure.query(async ({ ctx }) => {
    const ws = await ctx.db.query.workspaces.findFirst({
      where: eq(workspaces.createdByUserId, ctx.user.id),
    });
    if (!ws) return null;

    const [productRows, onboardingRow] = await Promise.all([
      ctx.db.query.products.findMany({
        where: eq(products.workspaceId, ws.id),
        orderBy: [asc(products.createdAt)],
      }),
      ctx.db.query.onboarding.findFirst({ where: eq(onboarding.workspaceId, ws.id) }),
    ]);

    const wireProducts = productRows
      .map(toWireProduct)
      .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));

    return {
      workspace: toWireWorkspace(ws, onboardingRow?.completed ?? false),
      products: wireProducts,
      primaryProduct: wireProducts.find((p) => p.isPrimary) ?? wireProducts[0] ?? null,
    };
  }),

  // Atomically creates the workspace + its products (>=1, one primary) + an
  // optional primary script template, and marks onboarding complete. Maps the
  // 11-step web wizard's full draft. The workspace-level targetBuyer/problemSolved
  // fan into every product (the wizard collects them once).
  completeOnboarding: protectedProcedure
    .input(
      z.object({
        workspaceName: z.string().min(1),
        website: z.string().optional(),
        industry: z.string().optional(),
        crmType: crmTypeSchema.nullable().optional(),
        targetBuyer: z.string().min(1),
        problemSolved: z.string().min(1),
        products: z
          .array(
            z.object({
              name: z.string().min(1),
              description: z.string().min(1),
              isPrimary: z.boolean(),
            }),
          )
          .min(1),
        scriptContent: z.string().optional(),
        crmStageTemplate: z.enum(['simple_b2b_sales', 'custom']),
        customStages: z
          .array(z.object({ name: z.string().min(1), order: z.number().int() }))
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Exactly one primary — trust the flag if set, else promote the first.
      const hasPrimary = input.products.some((p) => p.isPrimary);
      return ctx.db.transaction(async (tx) => {
        const [ws] = await tx
          .insert(workspaces)
          .values({
            name: input.workspaceName,
            website: input.website,
            industry: input.industry,
            crmType: input.crmType ?? null,
            crmStageTemplate: input.crmStageTemplate,
            customCrmStages: input.customStages,
            createdByUserId: ctx.user.id,
          })
          .returning();
        if (!ws) throw new Error('Failed to create workspace');

        const productRows = await tx
          .insert(products)
          .values(
            input.products.map((p, i) => ({
              workspaceId: ws.id,
              name: p.name,
              description: p.description,
              targetBuyer: input.targetBuyer,
              problemSolved: input.problemSolved,
              isPrimary: hasPrimary ? p.isPrimary : i === 0,
            })),
          )
          .returning();

        if (input.scriptContent && input.scriptContent.trim()) {
          await tx.insert(scriptTemplates).values({
            workspaceId: ws.id,
            name: 'Discovery Call',
            isPrimary: true,
            content: input.scriptContent,
          });
        }

        await tx.insert(onboarding).values({
          workspaceId: ws.id,
          completed: true,
          completedAt: new Date(),
        });

        return {
          workspace: toWireWorkspace(ws, true),
          products: productRows.map(toWireProduct),
        };
      });
    }),
});
