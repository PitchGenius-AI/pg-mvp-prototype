import { z } from 'zod';

// M17 restructures the detail page from 5 tabs to 4 — the M6 Evidence tab is
// renamed Activity and the Outcome tab is dropped (PG-221/PG-227).
export const detailTabs = ['overview', 'activity', 'diagnosis', 'export'] as const;
export const detailTabSchema = z.enum(detailTabs);
export type DetailTab = z.infer<typeof detailTabSchema>;

export const DEFAULT_TAB: DetailTab = 'overview';

export const detailSearchSchema = z.object({
  // `.catch` keeps stale links from the M6 5-tab layout (?tab=evidence /
  // ?tab=outcome) from throwing — they fall back to the default tab.
  tab: detailTabSchema.optional().catch(undefined),
});

export type DetailSearchParams = z.infer<typeof detailSearchSchema>;
