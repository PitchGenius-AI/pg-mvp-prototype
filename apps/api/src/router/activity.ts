import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { activityTypeSchema } from '@pg/shared';
import { activities, opportunities, readinessDiagnoses } from '@pg/db/schema';
import { protectedProcedure, router } from '../trpc';
import { assertActivityAccess, assertOpportunityAccess } from '../lib/authz';
import { toWireActivity } from '../lib/serialize';

export const activityRouter = router({
  listForOpportunity: protectedProcedure
    .input(z.object({ opportunityId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await assertOpportunityAccess(ctx, input.opportunityId);
      const rows = await ctx.db.query.activities.findMany({
        where: eq(activities.opportunityId, input.opportunityId),
        orderBy: [desc(activities.activityDate)],
      });
      return rows.map(toWireActivity);
    }),

  create: protectedProcedure
    .input(
      z.object({
        opportunityId: z.string().uuid(),
        activityType: activityTypeSchema,
        activityDate: z.string().datetime(),
        participants: z.array(z.string()).optional(),
        transcriptOrNotes: z.string().optional(),
        repSubjectiveNotes: z.string().optional(),
        checklist: z
          .object({
            nextStepAgreed: z.boolean().optional(),
            stakeholderAdded: z.boolean().optional(),
            pricingDiscussed: z.boolean().optional(),
            budgetDiscussed: z.boolean().optional(),
            competitorDiscussed: z.boolean().optional(),
            implementationDiscussed: z.boolean().optional(),
            securityDiscussed: z.boolean().optional(),
          })
          .default({}),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const opp = await assertOpportunityAccess(ctx, input.opportunityId);

      const [row] = await ctx.db
        .insert(activities)
        .values({
          workspaceId: opp.workspaceId,
          opportunityId: input.opportunityId,
          activityType: input.activityType,
          activityDate: new Date(input.activityDate),
          participants: input.participants,
          transcriptOrNotes: input.transcriptOrNotes,
          repSubjectiveNotes: input.repSubjectiveNotes,
          nextStepAgreed: input.checklist.nextStepAgreed ?? false,
          stakeholderAdded: input.checklist.stakeholderAdded ?? false,
          pricingDiscussed: input.checklist.pricingDiscussed ?? false,
          budgetDiscussed: input.checklist.budgetDiscussed ?? false,
          competitorDiscussed: input.checklist.competitorDiscussed ?? false,
          implementationDiscussed: input.checklist.implementationDiscussed ?? false,
          securityDiscussed: input.checklist.securityDiscussed ?? false,
        })
        .returning();
      if (!row) throw new Error('Failed to create activity');

      // Diagnosis is run explicitly via diagnosis.run({ activityId }) from the UI
      // (the Activity tab shows a "Run diagnosis" action), not auto-triggered here.
      return toWireActivity(row);
    }),

  delete: protectedProcedure
    .input(z.object({ activityId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { activity, opportunity: opp } = await assertActivityAccess(ctx, input.activityId);

      return ctx.db.transaction(async (tx) => {
        // Deleting the activity cascade-deletes its diagnosis (one-per-activity) and
        // any outcome feedback on that diagnosis (both FKs are onDelete: 'cascade').
        await tx.delete(activities).where(eq(activities.id, activity.id));

        // The opportunity's denormalized current_* readiness was stamped forward from
        // the latest diagnosis — possibly the one we just cascaded away. Re-stamp from
        // whatever diagnosis now remains (newest first), or clear it if none are left.
        // (atRisk is a separate, non-diagnosis-derived flag, so it's untouched.)
        const latest = await tx.query.readinessDiagnoses.findFirst({
          where: eq(readinessDiagnoses.opportunityId, opp.id),
          orderBy: [desc(readinessDiagnoses.createdAt)],
        });

        await tx
          .update(opportunities)
          .set({
            currentReadinessState: latest?.readinessState ?? null,
            currentReadinessScore: latest?.readinessScore ?? null,
            currentAlignmentOutcome: latest?.alignmentOutcome ?? null,
            currentAlignmentLevel: latest?.alignmentLevel ?? null,
            updatedAt: new Date(),
          })
          .where(eq(opportunities.id, opp.id));

        return { id: activity.id, opportunityId: opp.id };
      });
    }),
});
