import { z } from 'zod';

// URL-backed state for the Buyers directory (M13). TanStack Router validates
// this on every navigation, so a filtered/searched view is bookmarkable and the
// Workbench's unassigned-buyers banner can deep-link straight to it.
export const buyerStatusFilters = ['all', 'assigned', 'unassigned'] as const;
export const buyerStatusFilterSchema = z.enum(buyerStatusFilters);
export type BuyerStatusFilter = z.infer<typeof buyerStatusFilterSchema>;

export const DEFAULT_STATUS_FILTER: BuyerStatusFilter = 'all';

export const buyersSearchSchema = z.object({
  // `unassigned` is the value the Workbench banner deep-links with (PG-203).
  status: buyerStatusFilterSchema.optional(),
  q: z.string().optional(),
});

export type BuyersSearchParams = z.infer<typeof buyersSearchSchema>;
