import type { ActivityType } from '@pg/shared';
import {
  normalizeActivityType,
  type ActivityColumnMapping,
  type ActivityTargetField,
} from '../../mock/fake-activity-mapper';
import type { ImportActivityRow } from '../../mock/store';
import type { MockOpportunity } from '../../mock/types';

// Mapping + analysis helpers for the bulk Activities import (M15, PG-216/217).
// Sibling of import-data.ts — applies the confirmed column mapping to each
// source row, then resolves the auto-join against the workspace's opportunities.

// A raw row from the uploaded file — header-keyed cell strings (papaparse output).
export type ActivitySourceRow = Record<string, string>;

// Where a mapped row landed in the auto-join (PG-217):
//  - 'ready'     — has content and matched an opportunity by CRM Record ID
//  - 'unmatched' — has content but its Record ID matched no opportunity
//  - 'skipped'   — no subject and no body, so there's nothing to score
export type ActivityRowStatus = 'ready' | 'unmatched' | 'skipped';

export interface AnalyzedActivityRow {
  // 1-based row number in the source file, for the rep to cross-reference.
  index: number;
  row: ImportActivityRow;
  status: ActivityRowStatus;
  // The opportunity this activity auto-joins to, when matched.
  matchedOpportunity: MockOpportunity | null;
  matchedLabel: string | null;
  // Raw activity-type string from the file + what it normalized to (PG-218).
  activityTypeRaw: string;
  activityType: ActivityType;
}

export interface ActivityImportSummary {
  total: number;
  ready: number;
  unmatched: number;
  skipped: number;
  // Distinct opportunities the ready activities will attach to / re-score.
  opportunitiesAffected: number;
  // Normalized activity-type counts across the ready rows (PG-218).
  typeBreakdown: { type: ActivityType; count: number }[];
}

function firstValueFor(
  source: ActivitySourceRow,
  mappings: ActivityColumnMapping[],
  target: ActivityTargetField,
): string {
  for (const m of mappings) {
    if (m.targetField !== target) continue;
    const value = (source[m.sourceColumn] ?? '').trim();
    if (value) return value;
  }
  return '';
}

const nullable = (raw: string): string | null => (raw.length > 0 ? raw : null);

// Lenient date parse — CRM exports emit a range of formats. Falls back to "now"
// so a row is never dropped purely for an unparseable date. A bare YYYY-MM-DD is
// pinned to local noon: parsed as-is it lands on UTC midnight, which renders as
// the previous day in any timezone behind UTC.
function parseActivityDate(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed) {
    const parsed = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
      ? new Date(`${trimmed}T12:00:00`)
      : new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return new Date().toISOString();
}

function splitParticipants(raw: string): string[] {
  if (!raw) return [];
  return raw
    .split(/[;,]/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function opportunityLabel(opp: MockOpportunity): string {
  return opp.opportunityName || `Opportunity ${opp.crmRecordId ?? opp.id}`;
}

// Apply the confirmed column mapping to one source row.
export function mapActivityRow(
  source: ActivitySourceRow,
  mappings: ActivityColumnMapping[],
): ImportActivityRow {
  const get = (target: ActivityTargetField) => firstValueFor(source, mappings, target);
  return {
    crmRecordId: nullable(get('crm_record_id')),
    activityType: normalizeActivityType(get('activity_type')).type,
    activityDate: parseActivityDate(get('activity_date')),
    subject: nullable(get('activity_subject')),
    body: nullable(get('activity_body')),
    participants: splitParticipants(get('activity_participants')),
  };
}

export function analyzeActivityRows(
  sources: ActivitySourceRow[],
  mappings: ActivityColumnMapping[],
  opportunities: MockOpportunity[],
): AnalyzedActivityRow[] {
  // Index opportunities by CRM Record ID — the auto-join key (PG-217). Mirrors
  // the store's `importActivities` matching so the preview agrees with the commit.
  const oppByRecordId = new Map<string, MockOpportunity>();
  for (const opp of opportunities) {
    if (!opp.crmRecordId) continue;
    oppByRecordId.set(opp.crmRecordId.trim().toLowerCase(), opp);
  }

  return sources.map((source, i) => {
    const row = mapActivityRow(source, mappings);
    const typeRaw = firstValueFor(source, mappings, 'activity_type');
    const hasContent = Boolean(row.subject) || Boolean(row.body);
    const key = row.crmRecordId?.trim().toLowerCase();
    const matched = key ? oppByRecordId.get(key) ?? null : null;

    let status: ActivityRowStatus;
    if (!hasContent) status = 'skipped';
    else if (matched) status = 'ready';
    else status = 'unmatched';

    return {
      index: i + 1,
      row,
      status,
      matchedOpportunity: matched,
      matchedLabel: matched ? opportunityLabel(matched) : null,
      activityTypeRaw: typeRaw,
      activityType: row.activityType,
    };
  });
}

export function summarizeActivities(
  analyzed: AnalyzedActivityRow[],
): ActivityImportSummary {
  const ready = analyzed.filter((r) => r.status === 'ready');
  const affected = new Set(ready.map((r) => r.matchedOpportunity?.id));

  const typeCounts = new Map<ActivityType, number>();
  for (const r of ready) {
    typeCounts.set(r.activityType, (typeCounts.get(r.activityType) ?? 0) + 1);
  }

  return {
    total: analyzed.length,
    ready: ready.length,
    unmatched: analyzed.filter((r) => r.status === 'unmatched').length,
    skipped: analyzed.filter((r) => r.status === 'skipped').length,
    opportunitiesAffected: affected.size,
    typeBreakdown: [...typeCounts.entries()]
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count),
  };
}

// Rows handed to the store on commit: everything with content. The store does
// the authoritative matching and reports back what joined to nothing — passing
// unmatched-but-content rows through lets it surface them in the result.
export function importableActivityRows(
  analyzed: AnalyzedActivityRow[],
): ImportActivityRow[] {
  return analyzed.filter((r) => r.status !== 'skipped').map((r) => r.row);
}
