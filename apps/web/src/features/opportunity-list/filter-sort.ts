import type { AlignmentLevel } from '@pg/shared';
import { useMockStore } from '../../mock/store';
import type { MockBuyer, MockInteraction, MockOpportunity } from '../../mock/types';
import type { ListSearchParams, SortOption } from './search-schema';

// Severity ordering for "most over-projecting" sort. Higher number = more severe.
const ALIGNMENT_LEVEL_RANK: Record<AlignmentLevel, number> = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

export interface OpportunityRowData {
  opportunity: MockOpportunity;
  buyer: MockBuyer | null;
  latestInteractionDate: string;
}

// Joins opportunities with their buyer + latest-interaction date in a single
// read from the store. Returns rows sorted by updatedAt desc (default order
// before user sort kicks in).
export function selectOpportunityRows(workspaceId: string): OpportunityRowData[] {
  const state = useMockStore.getState();
  const opps = Object.values(state.opportunities).filter(
    (o) => o.workspaceId === workspaceId,
  );
  const interactionsByOpp = groupInteractionsByOpportunity(
    Object.values(state.interactions),
  );
  return opps
    .map((opp) => ({
      opportunity: opp,
      buyer: state.buyers[opp.buyerId] ?? null,
      latestInteractionDate: pickLatestInteractionDate(
        interactionsByOpp.get(opp.id),
        opp.createdAt,
      ),
    }))
    .sort((a, b) =>
      b.opportunity.updatedAt.localeCompare(a.opportunity.updatedAt),
    );
}

function groupInteractionsByOpportunity(
  interactions: MockInteraction[],
): Map<string, MockInteraction[]> {
  const result = new Map<string, MockInteraction[]>();
  for (const i of interactions) {
    const list = result.get(i.opportunityId);
    if (list) list.push(i);
    else result.set(i.opportunityId, [i]);
  }
  return result;
}

function pickLatestInteractionDate(
  interactions: MockInteraction[] | undefined,
  fallback: string,
): string {
  if (!interactions || interactions.length === 0) return fallback;
  return interactions.reduce(
    (latest, i) => (i.interactionDate > latest ? i.interactionDate : latest),
    interactions[0]!.interactionDate,
  );
}

export function applyFilters(
  rows: OpportunityRowData[],
  params: ListSearchParams,
): OpportunityRowData[] {
  let result = rows;

  if (params.readiness && params.readiness.length > 0) {
    const set = new Set(params.readiness);
    result = result.filter(
      (r) =>
        r.opportunity.currentReadinessState &&
        set.has(r.opportunity.currentReadinessState),
    );
  }

  if (params.alignment) {
    result = result.filter(
      (r) => r.opportunity.currentAlignmentOutcome === params.alignment,
    );
  }

  if (params.atRisk) {
    result = result.filter((r) => r.opportunity.atRisk);
  }

  const query = params.q?.trim().toLowerCase();
  if (query) {
    result = result.filter((r) => {
      const opp = r.opportunity;
      const buyer = r.buyer;
      const haystack = [
        opp.opportunityName,
        buyer?.firstName,
        buyer?.lastName,
        buyer?.company,
      ]
        .filter((s): s is string => Boolean(s))
        .map((s) => s.toLowerCase())
        .join(' ');
      return haystack.includes(query);
    });
  }

  return result;
}

export function applySort(
  rows: OpportunityRowData[],
  sort: SortOption,
): OpportunityRowData[] {
  const copy = [...rows];
  switch (sort) {
    case 'recent':
      return copy.sort((a, b) =>
        b.opportunity.updatedAt.localeCompare(a.opportunity.updatedAt),
      );
    case 'most_over_projecting':
      return copy.sort((a, b) => {
        const aOver = a.opportunity.currentAlignmentOutcome === 'over_projecting';
        const bOver = b.opportunity.currentAlignmentOutcome === 'over_projecting';
        if (aOver !== bOver) return aOver ? -1 : 1;
        const aLevel = a.opportunity.currentAlignmentLevel
          ? ALIGNMENT_LEVEL_RANK[a.opportunity.currentAlignmentLevel]
          : -1;
        const bLevel = b.opportunity.currentAlignmentLevel
          ? ALIGNMENT_LEVEL_RANK[b.opportunity.currentAlignmentLevel]
          : -1;
        if (aLevel !== bLevel) return bLevel - aLevel;
        return b.opportunity.updatedAt.localeCompare(a.opportunity.updatedAt);
      });
    case 'readiness_high':
      return copy.sort(
        (a, b) =>
          (b.opportunity.currentReadinessScore ?? -1) -
          (a.opportunity.currentReadinessScore ?? -1),
      );
    case 'readiness_low':
      return copy.sort(
        (a, b) =>
          (a.opportunity.currentReadinessScore ?? 999) -
          (b.opportunity.currentReadinessScore ?? 999),
      );
  }
}

export function alignmentColor(
  outcome: string | null | undefined,
  level: string | null | undefined,
): string {
  if (outcome === 'over_projecting') {
    if (level === 'critical' || level === 'high') return 'red';
    if (level === 'medium') return 'orange';
    return 'yellow';
  }
  if (outcome === 'under_projecting') return 'blue';
  if (outcome === 'aligned') return 'teal';
  return 'gray';
}

// Lightweight relative-time formatter (avoids pulling in dayjs's relativeTime
// plugin just for this). Resolution: just now / N min / N hr / N day / N mo / N yr ago.
export function relativeTime(iso: string, now = Date.now()): string {
  const then = new Date(iso).getTime();
  const diffMs = Math.max(0, now - then);
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} mo${months === 1 ? '' : 's'} ago`;
  const years = Math.floor(months / 12);
  return `${years} yr${years === 1 ? '' : 's'} ago`;
}
