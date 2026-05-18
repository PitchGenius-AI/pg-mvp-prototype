import { alignmentOutcomeSchema, readinessStateSchema } from '@pg/shared';
import { z } from 'zod';

export const sortOptions = [
  'recent',
  'most_over_projecting',
  'readiness_high',
  'readiness_low',
] as const;
export const sortSchema = z.enum(sortOptions);
export type SortOption = z.infer<typeof sortSchema>;

export const SORT_LABELS: Record<SortOption, string> = {
  recent: 'Most recently updated',
  most_over_projecting: 'Most over-projecting',
  readiness_high: 'Highest readiness score',
  readiness_low: 'Lowest readiness score',
};

// URL-backed list state. TanStack Router validates this on every navigation
// so bookmarks + back-button work and bad params get stripped.
export const listSearchSchema = z.object({
  q: z.string().optional(),
  readiness: z.array(readinessStateSchema).optional(),
  alignment: alignmentOutcomeSchema.optional(),
  atRisk: z.boolean().optional(),
  sort: sortSchema.optional(),
});

export type ListSearchParams = z.infer<typeof listSearchSchema>;

export const DEFAULT_SORT: SortOption = 'recent';

export function hasActiveFilters(params: ListSearchParams): boolean {
  return (
    (params.readiness && params.readiness.length > 0) ||
    !!params.alignment ||
    !!params.atRisk ||
    (!!params.q && params.q.trim().length > 0)
  );
}
