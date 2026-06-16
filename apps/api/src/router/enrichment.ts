import { TRPCError } from '@trpc/server';
import { enrichLead } from '@pg/ai';
import { enrichmentRequestSchema } from '@pg/shared';
import { protectedProcedure, router } from '../trpc';
import { resolveWorkspace } from '../lib/authz';
import { enrichmentProviders } from '../enrichment';

// Lead enrichment (PG-288, Increment 1). Single email / LinkedIn URL → ranked
// candidate people for the Manual Entry intake to pre-fill from. Returns parsed
// candidates for the rep to review/pick — never writes a buyer (the intake form
// does that after the rep confirms), so this is read-only beyond the AI calls.
export const enrichmentRouter = router({
  resolveLead: protectedProcedure
    .input(enrichmentRequestSchema)
    .mutation(async ({ ctx, input }) => {
      // Authz + onboarding gate: caller must own a workspace to enrich into it.
      await resolveWorkspace(ctx);

      if (enrichmentProviders.length === 0) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Lead enrichment is not configured (no search provider API keys set).',
        });
      }

      try {
        return await enrichLead({ client: ctx.anthropic, providers: enrichmentProviders }, input);
      } catch (err) {
        // All-providers-failed / LLM error — surface as a clean gateway error the
        // intake UI falls back from (manual entry), not an unhandled 500.
        throw new TRPCError({
          code: 'BAD_GATEWAY',
          message: 'Could not enrich that lead right now.',
          cause: err,
        });
      }
    }),
});
