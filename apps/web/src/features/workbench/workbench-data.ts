import {
  type AlignmentLevel,
  type AlignmentOutcome,
  type ReadinessState,
  readinessStates,
} from '@pg/shared';
import type { WorkbenchRow } from '../../mock/workbench-rows';
import type { SortColumn, SortDir, WorkbenchSearchParams } from './workbench-search';

export type { WorkbenchRow };

// --- Row accessors ---------------------------------------------------------

export const buyerName = (row: WorkbenchRow): string =>
  row.buyer ? [row.buyer.firstName, row.buyer.lastName].filter(Boolean).join(' ') : '';

export const companyName = (row: WorkbenchRow): string => row.buyer?.company ?? '';

// --- Board grouping --------------------------------------------------------

export interface StageColumn {
  stage: string;
  rows: WorkbenchRow[];
}

// Holds opportunities whose CRM stage isn't one of the workspace's configured
// stages (e.g. a bulk import row with a stage we don't recognise).
export const UNSTAGED_COLUMN = 'Unstaged';

export function groupRowsByStage(rows: WorkbenchRow[], stages: string[]): StageColumn[] {
  const byStage = new Map<string, WorkbenchRow[]>();
  for (const stage of stages) byStage.set(stage, []);
  const unstaged: WorkbenchRow[] = [];

  for (const row of rows) {
    const bucket = byStage.get(row.opportunity.currentCrmStage);
    if (bucket) bucket.push(row);
    else unstaged.push(row);
  }

  const columns: StageColumn[] = stages.map((stage) => ({
    stage,
    rows: sortBoardColumn(byStage.get(stage) ?? []),
  }));
  if (unstaged.length > 0) {
    columns.push({ stage: UNSTAGED_COLUMN, rows: sortBoardColumn(unstaged) });
  }
  return columns;
}

// Within a board column, surface the deals that need attention: most-severe
// alignment first, then most recent activity.
function sortBoardColumn(rows: WorkbenchRow[]): WorkbenchRow[] {
  return [...rows].sort((a, b) => {
    const severity = alignmentSeverity(b) - alignmentSeverity(a);
    if (severity !== 0) return severity;
    return b.latestActivityDate.localeCompare(a.latestActivityDate);
  });
}

// --- Severity / rank ranking ----------------------------------------------

const READINESS_RANK: Record<ReadinessState, number> = Object.fromEntries(
  readinessStates.map((state, i) => [state, i]),
) as Record<ReadinessState, number>;

// Higher = more attention-needed. Over-projecting (a forecast risk) outranks
// everything; aligned deals sit lowest among diagnosed deals.
export function alignmentSeverity(row: WorkbenchRow): number {
  const outcome = row.opportunity.currentAlignmentOutcome;
  const level = row.opportunity.currentAlignmentLevel;
  if (!outcome) return 0;
  if (outcome === 'over_projecting') return 5 + levelRank(level);
  if (outcome === 'under_projecting') return 1 + Math.min(levelRank(level), 3);
  return 1;
}

function levelRank(level: AlignmentLevel | null): number {
  switch (level) {
    case 'critical':
      return 4;
    case 'high':
      return 3;
    case 'medium':
      return 2;
    case 'low':
      return 1;
    default:
      return 0;
  }
}

// --- List filtering + sorting ----------------------------------------------

export function filterRows(
  rows: WorkbenchRow[],
  params: WorkbenchSearchParams,
): WorkbenchRow[] {
  let result = rows;

  if (params.stage) {
    result = result.filter((r) => r.opportunity.currentCrmStage === params.stage);
  }
  if (params.readiness && params.readiness.length > 0) {
    const set = new Set(params.readiness);
    result = result.filter(
      (r) =>
        r.opportunity.currentReadinessState != null &&
        set.has(r.opportunity.currentReadinessState),
    );
  }
  if (params.alignment) {
    result = result.filter(
      (r) => r.opportunity.currentAlignmentOutcome === params.alignment,
    );
  }
  if (params.product) {
    result = result.filter((r) => r.opportunity.productId === params.product);
  }

  const query = params.q?.trim().toLowerCase();
  if (query) {
    result = result.filter((r) => {
      const haystack = [r.opportunity.opportunityName, buyerName(r), companyName(r)]
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }

  return result;
}

export function sortRows(
  rows: WorkbenchRow[],
  sort: SortColumn,
  dir: SortDir,
  stages: string[],
): WorkbenchRow[] {
  const stageIndex = new Map(stages.map((s, i) => [s, i]));
  const factor = dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const primary = compareBy(a, b, sort, stageIndex);
    if (primary !== 0) return factor * primary;
    // Stable tiebreak: most recent activity first, regardless of direction.
    return b.latestActivityDate.localeCompare(a.latestActivityDate);
  });
}

function compareBy(
  a: WorkbenchRow,
  b: WorkbenchRow,
  sort: SortColumn,
  stageIndex: Map<string, number>,
): number {
  switch (sort) {
    case 'buyer':
      return buyerName(a).localeCompare(buyerName(b));
    case 'company':
      return companyName(a).localeCompare(companyName(b));
    case 'product':
      return (a.product?.name ?? '').localeCompare(b.product?.name ?? '');
    case 'stage':
      return (
        (stageIndex.get(a.opportunity.currentCrmStage) ?? 999) -
        (stageIndex.get(b.opportunity.currentCrmStage) ?? 999)
      );
    case 'readiness':
      return readinessRank(a) - readinessRank(b);
    case 'alignment':
      return alignmentSeverity(a) - alignmentSeverity(b);
    case 'score':
      return (
        (a.opportunity.currentReadinessScore ?? -1) -
        (b.opportunity.currentReadinessScore ?? -1)
      );
    case 'activity':
      return a.latestActivityDate.localeCompare(b.latestActivityDate);
  }
}

function readinessRank(row: WorkbenchRow): number {
  const state = row.opportunity.currentReadinessState;
  return state ? READINESS_RANK[state] : -1;
}

// --- Display labels --------------------------------------------------------

export const READINESS_LABELS: Record<ReadinessState, string> = {
  unaware: 'Unaware',
  problem_aware: 'Problem aware',
  diagnosis_aligned: 'Diagnosis aligned',
  solution_curious: 'Solution curious',
  solution_confident: 'Solution confident',
  stakeholder_validation_needed: 'Stakeholder validation',
  commercially_ready: 'Commercially ready',
  commit_ready: 'Commit ready',
  at_risk: 'At risk / regressed',
};

export const ALIGNMENT_LABELS: Record<AlignmentOutcome, string> = {
  over_projecting: 'Over-projecting',
  aligned: 'Aligned',
  under_projecting: 'Under-projecting',
};
