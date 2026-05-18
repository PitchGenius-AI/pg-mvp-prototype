import { z } from 'zod';
import { mapCsvColumns, parseOpportunity } from '@pg/ai';
import { protectedProcedure, router } from '../trpc';

// AI-driven intake helpers. Both return parsed data for the user to review
// before any DB write — never auto-commit AI output.
export const parserRouter = router({
  parseQuickPaste: protectedProcedure
    .input(z.object({ text: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      return parseOpportunity(ctx.anthropic, input.text);
    }),

  mapCsvColumns: protectedProcedure
    .input(
      z.object({
        headers: z.array(z.string()).min(1),
        sampleRows: z.array(z.array(z.string())).max(20),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return mapCsvColumns(ctx.anthropic, input.headers, input.sampleRows);
    }),
});
