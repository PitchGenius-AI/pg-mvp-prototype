import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { generatePrecall, type PrecallGeneratorInput } from '@pg/ai';
import {
  buyers,
  precallIntelligence,
  products,
  readinessDiagnoses,
  scriptTemplates,
} from '@pg/db/schema';
import { protectedProcedure, router } from '../trpc';
import { TRPCError } from '@trpc/server';
import { assertOpportunityAccess } from '../lib/authz';
import { toWirePrecall } from '../lib/serialize';

export const precallRouter = router({
  // Latest pre-call intelligence bundle for an opportunity, or null.
  forOpportunity: protectedProcedure
    .input(z.object({ opportunityId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await assertOpportunityAccess(ctx, input.opportunityId);
      const row = await ctx.db.query.precallIntelligence.findFirst({
        where: eq(precallIntelligence.opportunityId, input.opportunityId),
        orderBy: [desc(precallIntelligence.generatedAt)],
      });
      return row ? toWirePrecall(row) : null;
    }),

  // Generate (or regenerate) the bundle: DISC/OCEAN profile + matched technique +
  // script, grounded in the buyer, product, latest diagnosis, and script template.
  run: protectedProcedure
    .input(z.object({ opportunityId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const opp = await assertOpportunityAccess(ctx, input.opportunityId);

      const [buyer, product, latestDx, template] = await Promise.all([
        ctx.db.query.buyers.findFirst({ where: eq(buyers.id, opp.buyerId) }),
        ctx.db.query.products.findFirst({ where: eq(products.id, opp.productId) }),
        ctx.db.query.readinessDiagnoses.findFirst({
          where: eq(readinessDiagnoses.opportunityId, opp.id),
          orderBy: [desc(readinessDiagnoses.createdAt)],
        }),
        ctx.db.query.scriptTemplates.findFirst({
          where: and(
            eq(scriptTemplates.workspaceId, opp.workspaceId),
            eq(scriptTemplates.isPrimary, true),
          ),
        }),
      ]);
      if (!product) throw new TRPCError({ code: 'NOT_FOUND', message: 'Product not found' });

      const diagnosisSummary = latestDx
        ? `${latestDx.readinessState} (${latestDx.readinessScore}/100, ${latestDx.confidenceLevel} confidence). ` +
          `Primary blocker: ${latestDx.primaryBlocker ?? 'n/a'}. ` +
          `Alignment: ${latestDx.alignmentOutcome} (${latestDx.alignmentLevel}).`
        : null;

      const genInput: PrecallGeneratorInput = {
        buyerName: buyer ? `${buyer.firstName}${buyer.lastName ? ' ' + buyer.lastName : ''}` : 'the buyer',
        buyerTitle: buyer?.title ?? null,
        buyerCompany: buyer?.company ?? '(unknown)',
        productName: product.name,
        productDescription: product.description,
        targetBuyer: product.targetBuyer,
        problemSolved: product.problemSolved,
        opportunityName: opp.opportunityName,
        currentCrmStage: opp.currentCrmStage,
        knownPain: opp.knownPain,
        knownObjection: opp.knownObjection,
        diagnosisSummary,
        scriptTemplate: template?.content ?? null,
      };

      const out = await generatePrecall(ctx.anthropic, genInput);

      const generatedScript = {
        basedOnTemplateId: template?.id ?? null,
        technique: out.matchedTechnique.technique,
        sections: out.scriptSections,
      };

      const [row] = await ctx.db
        .insert(precallIntelligence)
        .values({
          workspaceId: opp.workspaceId,
          opportunityId: opp.id,
          psychProfile: out.psychProfile,
          matchedTechnique: out.matchedTechnique,
          generatedScript,
          technique: out.matchedTechnique.technique,
          discPrimaryType: out.psychProfile.disc.primaryType,
        })
        .returning();
      if (!row) throw new Error('Failed to persist pre-call intelligence');
      return toWirePrecall(row);
    }),

  // Persist rep edits to the script sections on the latest bundle.
  updateScript: protectedProcedure
    .input(
      z.object({
        opportunityId: z.string().uuid(),
        sections: z.array(z.object({ heading: z.string(), body: z.string() })),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertOpportunityAccess(ctx, input.opportunityId);
      const row = await ctx.db.query.precallIntelligence.findFirst({
        where: eq(precallIntelligence.opportunityId, input.opportunityId),
        orderBy: [desc(precallIntelligence.generatedAt)],
      });
      if (!row) throw new TRPCError({ code: 'NOT_FOUND' });
      const nextScript = { ...(row.generatedScript as object), sections: input.sections };
      const [updated] = await ctx.db
        .update(precallIntelligence)
        .set({ generatedScript: nextScript })
        .where(eq(precallIntelligence.id, row.id))
        .returning();
      if (!updated) throw new Error('Failed to update script');
      return toWirePrecall(updated);
    }),
});
