import { alignmentOutcomeSchema, readinessStateSchema } from '@pg/shared';
import { z } from 'zod';
import { workbenchPeriodSchema } from '../../lib/period';

// Sortable List-view columns. The Board view is always grouped by CRM stage, so
// this only governs the List table.
export const sortColumns = [
  'buyer',
  'company',
  'product',
  'stage',
  'readiness',
  'alignment',
  'score',
  'activity',
] as const;
export const sortColumnSchema = z.enum(sortColumns);
export type SortColumn = z.infer<typeof sortColumnSchema>;

export const sortDirSchema = z.enum(['asc', 'desc']);
export type SortDir = z.infer<typeof sortDirSchema>;

// The spec's headline: the List opens sorted by alignment severity so the deals
// the rep is over-projecting are the first thing they see.
export const DEFAULT_SORT: SortColumn = 'alignment';
export const DEFAULT_DIR: SortDir = 'desc';

// URL-backed List-view state. TanStack Router validates this on every navigation
// so filtered views are bookmarkable and bad params get stripped. The Board/List
// toggle itself is a per-user preference (localStorage), not URL state.
export const workbenchSearchSchema = z.object({
  // Top-level recency scope (Today by default — omitted from the URL when
  // default). Gates the rows feeding *both* Board and List, unlike the
  // secondary filters below which only narrow the List table.
  period: workbenchPeriodSchema.optional(),
  q: z.string().optional(),
  stage: z.string().optional(),
  readiness: z.array(readinessStateSchema).optional(),
  alignment: alignmentOutcomeSchema.optional(),
  product: z.string().optional(),
  sort: sortColumnSchema.optional(),
  dir: sortDirSchema.optional(),
});

export type WorkbenchSearchParams = z.infer<typeof workbenchSearchSchema>;

export function hasActiveFilters(params: WorkbenchSearchParams): boolean {
  return (
    !!params.stage ||
    (!!params.readiness && params.readiness.length > 0) ||
    !!params.alignment ||
    !!params.product ||
    (!!params.q && params.q.trim().length > 0)
  );
}
