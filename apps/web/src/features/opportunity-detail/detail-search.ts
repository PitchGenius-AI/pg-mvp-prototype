import { z } from 'zod';

export const detailTabs = ['overview', 'evidence', 'diagnosis', 'outcome', 'export'] as const;
export const detailTabSchema = z.enum(detailTabs);
export type DetailTab = z.infer<typeof detailTabSchema>;

export const DEFAULT_TAB: DetailTab = 'overview';

export const detailSearchSchema = z.object({
  tab: detailTabSchema.optional(),
});

export type DetailSearchParams = z.infer<typeof detailSearchSchema>;
