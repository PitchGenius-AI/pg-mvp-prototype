import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import {
  extractSignals,
  generateDiagnosis,
  type DiagnosisGeneratorInput,
  type SignalExtractorInput,
} from '@pg/ai';
import { opportunities, products, readinessDiagnoses } from '@pg/db/schema';
import { protectedProcedure, router } from '../trpc';
import { TRPCError } from '@trpc/server';
import { assertActivityAccess, assertOpportunityAccess } from '../lib/authz';
import { toWireDiagnosis } from '../lib/serialize';

export const diagnosisRouter = router({
  latestForOpportunity: protectedProcedure
    .input(z.object({ opportunityId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await assertOpportunityAccess(ctx, input.opportunityId);
      const row = await ctx.db.query.readinessDiagnoses.findFirst({
        where: eq(readinessDiagnoses.opportunityId, input.opportunityId),
        orderBy: [desc(readinessDiagnoses.createdAt)],
      });
      return row ? toWireDiagnosis(row) : null;
    }),

  listForOpportunity: protectedProcedure
    .input(z.object({ opportunityId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await assertOpportunityAccess(ctx, input.opportunityId);
      const rows = await ctx.db.query.readinessDiagnoses.findMany({
        where: eq(readinessDiagnoses.opportunityId, input.opportunityId),
        orderBy: [desc(readinessDiagnoses.createdAt)],
      });
      return rows.map(toWireDiagnosis);
    }),

  // The end-to-end AI pipeline for one activity:
  //   1. Load product + opportunity + activity context
  //   2. Extract signals (Claude call 1)
  //   3. Generate diagnosis (Claude call 2)
  //   4. Persist diagnosis row + update opportunity's denormalized current_* fields
  run: protectedProcedure
    .input(z.object({ activityId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { activity, opportunity: opp } = await assertActivityAccess(ctx, input.activityId);

      const product = await ctx.db.query.products.findFirst({
        where: eq(products.id, opp.productId),
      });
      if (!product) throw new TRPCError({ code: 'NOT_FOUND' });

      const buyer = await ctx.db.query.buyers.findFirst({
        where: (b, { eq }) => eq(b.id, opp.buyerId),
      });
      const buyerCompany = buyer?.company ?? '(unknown)';

      // 1. Extract signals
      const signalInput: SignalExtractorInput = {
        productName: product.name,
        productDescription: product.description,
        targetBuyer: product.targetBuyer,
        problemSolved: product.problemSolved,
        activityType: activity.activityType,
        transcriptOrNotes: activity.transcriptOrNotes,
        repSubjectiveNotes: activity.repSubjectiveNotes,
        checklist: {
          nextStepAgreed: activity.nextStepAgreed,
          stakeholderAdded: activity.stakeholderAdded,
          pricingDiscussed: activity.pricingDiscussed,
          budgetDiscussed: activity.budgetDiscussed,
          competitorDiscussed: activity.competitorDiscussed,
          implementationDiscussed: activity.implementationDiscussed,
          securityDiscussed: activity.securityDiscussed,
        },
      };
      const signals = await extractSignals(ctx.anthropic, signalInput);

      // 2. Generate diagnosis
      const diagInput: DiagnosisGeneratorInput = {
        productName: product.name,
        productDescription: product.description,
        targetBuyer: product.targetBuyer,
        problemSolved: product.problemSolved,
        opportunityName: opp.opportunityName,
        buyerCompany,
        currentCrmStage: opp.currentCrmStage,
        knownPain: opp.knownPain,
        knownObjection: opp.knownObjection,
        signals,
        priorReadinessState: opp.currentReadinessState ?? null,
        // Commercial evidence (rule 2) — any pricing / budget / implementation /
        // security discussion recorded on the activity.
        commercialEvidence:
          activity.pricingDiscussed ||
          activity.budgetDiscussed ||
          activity.implementationDiscussed ||
          activity.securityDiscussed,
      };
      const diagnosis = await generateDiagnosis(ctx.anthropic, diagInput);

      // 3. Persist + denormalize
      return ctx.db.transaction(async (tx) => {
        const [row] = await tx
          .insert(readinessDiagnoses)
          .values({
            workspaceId: opp.workspaceId,
            opportunityId: opp.id,
            activityId: activity.id,
            signalExtraction: signals,
            diagnosis,
            readinessState: diagnosis.readiness_state,
            readinessScore: diagnosis.readiness_score,
            confidenceLevel: diagnosis.confidence_level,
            alignmentOutcome: diagnosis.pipeline_reality_check.outcome,
            alignmentLevel: diagnosis.pipeline_reality_check.level,
            alignmentReason: diagnosis.pipeline_reality_check.reason,
            primaryBlocker: diagnosis.primary_blocker,
            secondaryBlocker: diagnosis.secondary_blocker,
            // TODO: render crmNoteText from the diagnosis (move to packages/shared as a fmt fn).
            crmNoteText: '',
            followUpSubject: diagnosis.follow_up_email.subject,
            followUpBody: diagnosis.follow_up_email.body,
            managerCoachingNote: diagnosis.manager_coaching_note,
          })
          .returning();

        await tx
          .update(opportunities)
          .set({
            currentReadinessState: diagnosis.readiness_state,
            currentReadinessScore: diagnosis.readiness_score,
            currentAlignmentOutcome: diagnosis.pipeline_reality_check.outcome,
            currentAlignmentLevel: diagnosis.pipeline_reality_check.level,
            updatedAt: new Date(),
          })
          .where(eq(opportunities.id, opp.id));

        if (!row) throw new Error('Failed to persist diagnosis');
        return toWireDiagnosis(row);
      });
    }),
});
