import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { activityTypeSchema } from '@pg/shared';
import { activities, opportunities, workspaces } from '@pg/db/schema';
import { protectedProcedure, router } from '../trpc';
import { TRPCError } from '@trpc/server';

export const activityRouter = router({
  listForOpportunity: protectedProcedure
    .input(z.object({ opportunityId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const opp = await ctx.db.query.opportunities.findFirst({
        where: eq(opportunities.id, input.opportunityId),
      });
      if (!opp) throw new TRPCError({ code: 'NOT_FOUND' });
      // Authz
      const ws = await ctx.db.query.workspaces.findFirst({
        where: and(
          eq(workspaces.id, opp.workspaceId),
          eq(workspaces.createdByUserId, ctx.user.id),
        ),
      });
      if (!ws) throw new TRPCError({ code: 'FORBIDDEN' });

      return ctx.db.query.activities.findMany({
        where: eq(activities.opportunityId, input.opportunityId),
        orderBy: [desc(activities.activityDate)],
      });
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
      const opp = await ctx.db.query.opportunities.findFirst({
        where: eq(opportunities.id, input.opportunityId),
      });
      if (!opp) throw new TRPCError({ code: 'NOT_FOUND' });
      const ws = await ctx.db.query.workspaces.findFirst({
        where: and(
          eq(workspaces.id, opp.workspaceId),
          eq(workspaces.createdByUserId, ctx.user.id),
        ),
      });
      if (!ws) throw new TRPCError({ code: 'FORBIDDEN' });

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

      // TODO (next ticket): trigger diagnosis pipeline async — extract signals,
      // generate diagnosis, persist to readinessDiagnoses, update opportunity
      // denormalized state. See packages/ai/src/prompts and diagnosis router.
      return row;
    }),
});
