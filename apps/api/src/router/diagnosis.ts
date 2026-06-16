import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import {
  extractSignals,
  generateDiagnosis,
  type DiagnosisGeneratorInput,
  type PriorDiagnosisContext,
  type SignalExtractorInput,
} from '@pg/ai';
import type { ReadinessDiagnosis, SignalExtraction } from '@pg/shared';
import {
  activities,
  diagnosisJobs,
  opportunities,
  products,
  readinessDiagnoses,
} from '@pg/db/schema';

// How many of the most recent prior activities' signal extractions to feed into a
// new diagnosis as granular detail. The prior diagnosis is the rolling synthesis of
// everything older, so this stays small to keep context bounded over a deal's life.
const RECENT_SIGNAL_WINDOW = 5;
import { protectedProcedure, router } from '../trpc';
import { TRPCError } from '@trpc/server';
import type { Context } from '../context';
import { assertActivityAccess, assertOpportunityAccess } from '../lib/authz';
import { toWireDiagnosis, toWireDiagnosisJob, type WireDiagnosis } from '../lib/serialize';

// The slice of context the AI pipeline needs. `db` and `anthropic` are module-level
// singletons (see context.ts), so a detached background worker can safely close over
// them after the request that spawned it has returned.
type DiagnosisDeps = Pick<Context, 'db' | 'anthropic'>;
type ActivityRow = typeof activities.$inferSelect;
type OpportunityRow = typeof opportunities.$inferSelect;

// The end-to-end AI pipeline for one activity, factored out so both the synchronous
// `run` mutation and the background worker drive the identical chain:
//   1. Load product + buyer + recent prior diagnoses for context
//   2. Extract signals (Claude call 1)
//   3. Generate diagnosis (Claude call 2)
//   4. Persist the diagnosis row + denormalize the opportunity's current_* fields
async function executeDiagnosis(
  deps: DiagnosisDeps,
  activity: ActivityRow,
  opp: OpportunityRow,
): Promise<{ diagnosis: WireDiagnosis; diagnosisId: string }> {
  const { db, anthropic } = deps;

  const product = await db.query.products.findFirst({
    where: eq(products.id, opp.productId),
  });
  if (!product) throw new TRPCError({ code: 'NOT_FOUND' });

  const buyer = await db.query.buyers.findFirst({
    where: (b, { eq }) => eq(b.id, opp.buyerId),
  });
  const buyerCompany = buyer?.company ?? '(unknown)';

  // Load the recent prior diagnoses for this opportunity (newest first). The latest
  // is the rolling synthesis we evolve from; the window supplies recent granular
  // signal detail. A new (or recovered) activity has none of its own yet.
  const priorDiagnosisRows = await db.query.readinessDiagnoses.findMany({
    where: eq(readinessDiagnoses.opportunityId, opp.id),
    orderBy: [desc(readinessDiagnoses.createdAt)],
    limit: RECENT_SIGNAL_WINDOW,
  });

  const latestPrior = priorDiagnosisRows[0];
  const priorDiagnosis: PriorDiagnosisContext | null = latestPrior
    ? (() => {
        const dx = latestPrior.diagnosis as ReadinessDiagnosis;
        return {
          readinessState: latestPrior.readinessState,
          readinessScore: latestPrior.readinessScore,
          confidenceLevel: latestPrior.confidenceLevel,
          primaryBlocker: latestPrior.primaryBlocker,
          secondaryBlocker: latestPrior.secondaryBlocker,
          alignmentOutcome: latestPrior.alignmentOutcome,
          recommendedNextAction: dx.recommended_next_action,
          dimensions: dx.dimension_scores.map((d) => ({
            dimension: d.dimension,
            score: d.score,
            diagnosis: d.diagnosis,
          })),
          diagnosedAt: latestPrior.createdAt?.toISOString() ?? null,
        };
      })()
    : null;

  // Oldest → newest so the model reads the recent history in order.
  const recentSignals: SignalExtraction[] = priorDiagnosisRows
    .map((r) => r.signalExtraction as SignalExtraction)
    .reverse();

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
  const signals = await extractSignals(anthropic, signalInput);

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
    priorDiagnosis,
    recentSignals,
    // Commercial evidence (rule 2) — any pricing / budget / implementation /
    // security discussion recorded on the activity.
    commercialEvidence:
      activity.pricingDiscussed ||
      activity.budgetDiscussed ||
      activity.implementationDiscussed ||
      activity.securityDiscussed,
  };
  const diagnosis = await generateDiagnosis(anthropic, diagInput);

  // 3. Persist + denormalize (single transaction — the opportunity's current_*
  // readiness MUST move forward atomically with the new diagnosis row).
  return db.transaction(async (tx) => {
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

    if (!row) throw new Error('Failed to persist diagnosis');

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

    return { diagnosis: toWireDiagnosis(row), diagnosisId: row.id };
  });
}

// The background worker: run the chain, then flip the job row to done/failed. Detached
// (fire-and-forget) from the enqueue mutation; never throws to its caller.
async function runDiagnosisJob(
  deps: DiagnosisDeps,
  jobId: string,
  activity: ActivityRow,
  opp: OpportunityRow,
): Promise<void> {
  try {
    const { diagnosisId } = await executeDiagnosis(deps, activity, opp);
    await deps.db
      .update(diagnosisJobs)
      .set({ status: 'done', diagnosisId, updatedAt: new Date() })
      .where(eq(diagnosisJobs.id, jobId));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Diagnosis failed';
    // eslint-disable-next-line no-console
    console.error('[diagnosis] background job failed', jobId, err);
    try {
      await deps.db
        .update(diagnosisJobs)
        .set({ status: 'failed', error: message.slice(0, 2000), updatedAt: new Date() })
        .where(eq(diagnosisJobs.id, jobId));
    } catch {
      // Best-effort — if even the failure write fails, the UI's staleness guard
      // eventually surfaces the stuck job as failed.
    }
  }
}

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

  // The recent jobs for an opportunity, so the Activity tab can show each activity's
  // live run state ("diagnosing… / failed") and poll until it settles.
  jobsForOpportunity: protectedProcedure
    .input(z.object({ opportunityId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await assertOpportunityAccess(ctx, input.opportunityId);
      const rows = await ctx.db.query.diagnosisJobs.findMany({
        where: eq(diagnosisJobs.opportunityId, input.opportunityId),
        orderBy: [desc(diagnosisJobs.createdAt)],
      });
      return rows.map(toWireDiagnosisJob);
    }),

  // Synchronous run — kept for callers that want to block on the result (e.g. tests
  // or a scripted backfill). The UI uses `enqueue` so the modal never blocks on the
  // ~multi-second Claude chain.
  run: protectedProcedure
    .input(z.object({ activityId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { activity, opportunity: opp } = await assertActivityAccess(ctx, input.activityId);
      const { diagnosis } = await executeDiagnosis(ctx, activity, opp);
      return diagnosis;
    }),

  // Background run — insert a 'running' job, kick off the in-process worker, and
  // return the job immediately. The client polls `jobsForOpportunity` until the job
  // flips to 'done' (then the diagnosis query has the result) or 'failed'.
  enqueue: protectedProcedure
    .input(z.object({ activityId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { activity, opportunity: opp } = await assertActivityAccess(ctx, input.activityId);

      // Idempotency: if a run is already in flight for this activity, return it
      // instead of starting a second (the modal-close and per-card retry can race).
      const existing = await ctx.db.query.diagnosisJobs.findFirst({
        where: and(eq(diagnosisJobs.activityId, activity.id), eq(diagnosisJobs.status, 'running')),
        orderBy: [desc(diagnosisJobs.createdAt)],
      });
      if (existing) return toWireDiagnosisJob(existing);

      const [job] = await ctx.db
        .insert(diagnosisJobs)
        .values({
          workspaceId: opp.workspaceId,
          opportunityId: opp.id,
          activityId: activity.id,
          status: 'running',
        })
        .returning();
      if (!job) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

      // Fire-and-forget: db + anthropic are module singletons, so the worker safely
      // outlives this request. Errors are captured onto the job row, never thrown here.
      void runDiagnosisJob({ db: ctx.db, anthropic: ctx.anthropic }, job.id, activity, opp);

      return toWireDiagnosisJob(job);
    }),
});
