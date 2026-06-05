import { z } from 'zod';

// The recency scope a rep works in, anchored to the daily import → work → export
// loop. Shared by the Opportunity Workbench and the Live Co-pilot picker so both
// surfaces filter "what am I working today" off the exact same definition.
//
// `today` / `yesterday` are single-day buckets (a given day's working set);
// `this_week` is cumulative from the start of the current week (Monday) through
// now; `all` applies no filter. A deal's recency signal is its last change
// (`updatedAt`) — "anything I touched in this window" — so an older deal you
// re-scored or moved today comes back into Today.
export const workbenchPeriods = ['today', 'yesterday', 'this_week', 'all'] as const;
export const workbenchPeriodSchema = z.enum(workbenchPeriods);
export type WorkbenchPeriod = z.infer<typeof workbenchPeriodSchema>;

// Both surfaces open scoped to today's working set (the morning import).
export const DEFAULT_PERIOD: WorkbenchPeriod = 'today';

export const PERIOD_LABELS: Record<WorkbenchPeriod, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  this_week: 'This week',
  all: 'All',
};

// --- Local-time boundary math ----------------------------------------------
// All boundaries use the local calendar, matching how a rep thinks about their
// day, not UTC.

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + n);
  return next;
}

// Monday as the first day of the week.
function startOfWeek(d: Date): Date {
  const start = startOfDay(d);
  const mondayOffset = (start.getDay() + 6) % 7; // Mon → 0 … Sun → 6
  return addDays(start, -mondayOffset);
}

// Whether an ISO timestamp falls within `period`, relative to `now`. A bad/empty
// timestamp never matches a bounded period.
export function isInPeriod(iso: string, period: WorkbenchPeriod, now: Date = new Date()): boolean {
  if (period === 'all') return true;

  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;

  const todayStart = startOfDay(now).getTime();
  const tomorrowStart = addDays(startOfDay(now), 1).getTime();

  switch (period) {
    case 'today':
      return t >= todayStart && t < tomorrowStart;
    case 'yesterday': {
      const yesterdayStart = addDays(startOfDay(now), -1).getTime();
      return t >= yesterdayStart && t < todayStart;
    }
    case 'this_week':
      return t >= startOfWeek(now).getTime() && t < tomorrowStart;
  }
}

// Filter any list to a period using an ISO accessor — works for Workbench rows
// (`r.lastActiveAt`) and anything else carrying a recency timestamp.
export function filterByPeriod<T>(
  items: T[],
  getIso: (item: T) => string,
  period: WorkbenchPeriod,
  now: Date = new Date(),
): T[] {
  if (period === 'all') return items;
  return items.filter((item) => isInPeriod(getIso(item), period, now));
}

// Count how many items fall in each bucket — drives the per-bucket counts shown
// on the filter controls. `all` is always the full size.
export function periodCounts<T>(
  items: T[],
  getIso: (item: T) => string,
  now: Date = new Date(),
): Record<WorkbenchPeriod, number> {
  const counts: Record<WorkbenchPeriod, number> = {
    today: 0,
    yesterday: 0,
    this_week: 0,
    all: items.length,
  };
  for (const item of items) {
    const iso = getIso(item);
    if (isInPeriod(iso, 'today', now)) counts.today += 1;
    if (isInPeriod(iso, 'yesterday', now)) counts.yesterday += 1;
    if (isInPeriod(iso, 'this_week', now)) counts.this_week += 1;
  }
  return counts;
}
