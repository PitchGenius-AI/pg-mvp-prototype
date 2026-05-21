import type { ColumnMapping, ImportTargetField } from '../../mock/fake-import-mapper';
import type { ImportBuyerRow } from '../../mock/store';

// Mapping + analysis helpers for the Daily Workbench import (M14, PG-212).

// A raw row from the uploaded file — header-keyed cell strings (papaparse output).
export type SourceRow = Record<string, string>;

// Per-row outcome of applying the confirmed mapping — backs the missing-data
// check (what's present/missing per row, and what it costs).
export interface AnalyzedRow {
  // 1-based row number in the source file, for the rep to cross-reference.
  index: number;
  row: ImportBuyerRow;
  buyerName: string;
  company: string;
  // Importable rows have the two required fields (first name + company).
  importable: boolean;
  missingRequired: string[];
  // A row without a CRM Record ID still imports — it just exports copy-only.
  hasRecordId: boolean;
  hasStage: boolean;
}

export interface ImportSummary {
  total: number;
  importable: number;
  skipped: number;
  withRecordId: number;
  withoutRecordId: number;
  withoutStage: number;
}

function firstValueFor(
  source: SourceRow,
  mappings: ColumnMapping[],
  target: ImportTargetField,
): string {
  // A target can only be claimed once (autoMapColumns enforces it), but a
  // manually-edited mapping might double up — take the first non-empty hit.
  for (const m of mappings) {
    if (m.targetField !== target) continue;
    const value = (source[m.sourceColumn] ?? '').trim();
    if (value) return value;
  }
  return '';
}

function parseNumber(raw: string): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[,$\s]/g, '');
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

const nullable = (raw: string): string | null => (raw.length > 0 ? raw : null);

// Apply the confirmed column mapping to one source row.
export function mapRow(source: SourceRow, mappings: ColumnMapping[]): ImportBuyerRow {
  const get = (target: ImportTargetField) => firstValueFor(source, mappings, target);
  return {
    buyer: {
      firstName: get('buyer_first_name'),
      lastName: nullable(get('buyer_last_name')),
      title: nullable(get('buyer_title')),
      company: get('buyer_company'),
      email: nullable(get('buyer_email')),
      linkedin: nullable(get('buyer_linkedin')),
    },
    opportunity: {
      opportunityName: get('opportunity_name'),
      currentCrmStage: get('current_crm_stage'),
      opportunityValue: parseNumber(get('opportunity_value')),
      expectedCloseDate: nullable(get('expected_close_date')),
      knownPain: nullable(get('known_pain')),
      knownObjection: nullable(get('known_objection')),
      dealNotes: nullable(get('deal_notes')),
      crmRecordId: nullable(get('crm_record_id')),
    },
  };
}

export function analyzeRows(
  sources: SourceRow[],
  mappings: ColumnMapping[],
): AnalyzedRow[] {
  return sources.map((source, i) => {
    const row = mapRow(source, mappings);
    const missingRequired: string[] = [];
    if (!row.buyer.firstName) missingRequired.push('first name');
    if (!row.buyer.company) missingRequired.push('company');
    return {
      index: i + 1,
      row,
      buyerName:
        [row.buyer.firstName, row.buyer.lastName].filter(Boolean).join(' ') || '—',
      company: row.buyer.company || '—',
      importable: missingRequired.length === 0,
      missingRequired,
      hasRecordId: row.opportunity.crmRecordId !== null,
      hasStage: row.opportunity.currentCrmStage.length > 0,
    };
  });
}

export function summarize(analyzed: AnalyzedRow[]): ImportSummary {
  const importable = analyzed.filter((r) => r.importable);
  return {
    total: analyzed.length,
    importable: importable.length,
    skipped: analyzed.length - importable.length,
    withRecordId: importable.filter((r) => r.hasRecordId).length,
    withoutRecordId: importable.filter((r) => !r.hasRecordId).length,
    withoutStage: importable.filter((r) => !r.hasStage).length,
  };
}

// The minimum to commit an import: a column mapped to the buyer's first name and
// one to the company. Everything else is optional — the confirmation gate stays
// closed until these two are mapped.
export function requiredFieldsMapped(mappings: ColumnMapping[]): boolean {
  const targets = new Set(
    mappings.map((m) => m.targetField).filter((t): t is ImportTargetField => t !== null),
  );
  return targets.has('buyer_first_name') && targets.has('buyer_company');
}
