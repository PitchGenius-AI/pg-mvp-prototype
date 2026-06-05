import { z } from 'zod';

// M17 restructured the detail page from 5 tabs to 4 — the M6 Evidence tab was
// renamed Activity and the Outcome tab dropped (PG-221/PG-227). The Pipeline
// Reality Check leads the Overview tab (with a link into the Diagnosis tab that
// supports it); the Diagnosis tab carries that same card plus the full
// supporting detail (dimensions, blockers, signals, recommended action…).
export const detailTabs = ['overview', 'activity', 'diagnosis', 'export'] as const;
export const detailTabSchema = z.enum(detailTabs);
export type DetailTab = z.infer<typeof detailTabSchema>;

export const DEFAULT_TAB: DetailTab = 'overview';

export const detailSearchSchema = z.object({
  // `.catch` keeps stale links from earlier layouts (?tab=evidence / ?tab=outcome
  // / ?tab=diagnosis) from throwing — they fall back to the default tab.
  tab: detailTabSchema.optional().catch(undefined),
});

export type DetailSearchParams = z.infer<typeof detailSearchSchema>;
