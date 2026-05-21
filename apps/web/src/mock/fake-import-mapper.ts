// Mock column-mapper for the Daily Workbench import (M14, PG-212). Stands in for
// the AI csvColumnMappingSchema chain — deterministic pattern-matching on the
// source column name, with a confidence score so the UI can flag low-confidence
// mappings for review at the confirmation gate. A real CRM export carries an
// arbitrary column structure; this adapts to whatever headers it finds.

import type { ImportMappingField } from '@pg/shared';

// Fields the import can land in. The persisted ones map onto buyer / opportunity
// columns; `deal_owner` and `last_activity_date` are recognized so they don't
// show as "unmapped" noise, but they are informational only — the rep is always
// the owner, and last-activity is not stored on the opportunity.
export const IMPORT_TARGET_FIELDS = [
  'opportunity_name',
  'buyer_first_name',
  'buyer_last_name',
  'buyer_title',
  'buyer_company',
  'buyer_email',
  'buyer_linkedin',
  'crm_record_id',
  'current_crm_stage',
  'opportunity_value',
  'expected_close_date',
  'deal_owner',
  'last_activity_date',
  'known_pain',
  'known_objection',
  'deal_notes',
] as const;

export type ImportTargetField = (typeof IMPORT_TARGET_FIELDS)[number];

// Human-readable labels for the mapping table + preview.
export const IMPORT_FIELD_LABELS: Record<ImportTargetField, string> = {
  opportunity_name: 'Opportunity name',
  buyer_first_name: 'Buyer first name',
  buyer_last_name: 'Buyer last name',
  buyer_title: 'Buyer title',
  buyer_company: 'Company',
  buyer_email: 'Buyer email',
  buyer_linkedin: 'Buyer LinkedIn',
  crm_record_id: 'CRM Record ID',
  current_crm_stage: 'CRM stage',
  opportunity_value: 'Opportunity value',
  expected_close_date: 'Expected close date',
  deal_owner: 'Deal owner',
  last_activity_date: 'Last activity date',
  known_pain: 'Known pain',
  known_objection: 'Known objection',
  deal_notes: 'Deal notes',
};

// Fields that carry into a created buyer/opportunity. `deal_owner` and
// `last_activity_date` are deliberately absent — recognized but not persisted.
export const PERSISTED_IMPORT_FIELDS = new Set<ImportTargetField>([
  'opportunity_name',
  'buyer_first_name',
  'buyer_last_name',
  'buyer_title',
  'buyer_company',
  'buyer_email',
  'buyer_linkedin',
  'crm_record_id',
  'current_crm_stage',
  'opportunity_value',
  'expected_close_date',
  'known_pain',
  'known_objection',
  'deal_notes',
]);

interface MappingRule {
  pattern: RegExp;
  target: ImportTargetField;
  confidence: number;
  reasoning: string;
}

const RULES: MappingRule[] = [
  // CRM Record ID — checked first; a HubSpot/Pipedrive export leads with it.
  {
    pattern: /record[_\s-]?id|system[_\s-]?id|hubspot[_\s-]?id|pipedrive[_\s-]?id|^deal[_\s-]?id$|^id$/i,
    target: 'crm_record_id',
    confidence: 1,
    reasoning: 'Matches a CRM record identifier column',
  },

  { pattern: /^opportunity[_\s-]?name$|^opp[_\s-]?name$/i, target: 'opportunity_name', confidence: 1, reasoning: 'Exact match for opportunity name' },
  { pattern: /^name$|^deal[_\s-]?name$|^deal[_\s-]?title$/i, target: 'opportunity_name', confidence: 0.7, reasoning: 'Generic "name" assumed to be the opportunity' },

  { pattern: /^first[_\s-]?name$|^buyer[_\s-]?first|^contact[_\s-]?first/i, target: 'buyer_first_name', confidence: 1, reasoning: 'Column name matches first name' },
  { pattern: /^last[_\s-]?name$|^buyer[_\s-]?last|^contact[_\s-]?last/i, target: 'buyer_last_name', confidence: 1, reasoning: 'Column name matches last name' },
  { pattern: /^title$|^role$|^position$|^job[_\s-]?title$/i, target: 'buyer_title', confidence: 0.95, reasoning: 'Title / role / position column' },
  { pattern: /^company$|^company[_\s-]?name$|^account$|^account[_\s-]?name$|^organization$|^org$/i, target: 'buyer_company', confidence: 1, reasoning: 'Standard company column' },
  { pattern: /^email$|^buyer[_\s-]?email$|^contact[_\s-]?email$|e[_\s-]?mail/i, target: 'buyer_email', confidence: 1, reasoning: 'Email column' },
  { pattern: /linkedin/i, target: 'buyer_linkedin', confidence: 0.95, reasoning: 'Contains "linkedin"' },

  { pattern: /^stage$|^crm[_\s-]?stage$|^pipeline[_\s-]?stage$|^deal[_\s-]?stage$/i, target: 'current_crm_stage', confidence: 1, reasoning: 'CRM pipeline stage column' },

  { pattern: /^value$|^amount$|^arr$|^deal[_\s-]?value$|^deal[_\s-]?amount$/i, target: 'opportunity_value', confidence: 0.95, reasoning: 'Deal value column' },
  { pattern: /^close[_\s-]?date$|^expected[_\s-]?close|^closing[_\s-]?date$/i, target: 'expected_close_date', confidence: 1, reasoning: 'Expected close date' },

  { pattern: /owner|account[_\s-]?owner|deal[_\s-]?owner|^rep$|^sales[_\s-]?rep$/i, target: 'deal_owner', confidence: 0.85, reasoning: 'Deal owner / rep column (informational)' },
  { pattern: /last[_\s-]?activity|last[_\s-]?contact|last[_\s-]?touch|last[_\s-]?modified/i, target: 'last_activity_date', confidence: 0.9, reasoning: 'Last activity date (informational)' },

  { pattern: /pain/i, target: 'known_pain', confidence: 0.9, reasoning: 'Column references "pain"' },
  { pattern: /objection|risk|blocker/i, target: 'known_objection', confidence: 0.85, reasoning: 'Column references objection / risk' },
  { pattern: /notes?$|comment|description/i, target: 'deal_notes', confidence: 0.8, reasoning: 'Free-text notes column' },
];

export interface ColumnMapping {
  sourceColumn: string;
  targetField: ImportTargetField | null;
  confidence: number;
  reasoning: string;
  // Set when the mapping came from a previously-saved import mapping rather
  // than the auto-mapper — surfaced in the UI as "from your saved mapping".
  fromSaved: boolean;
}

export type ConfidenceTier = 'high' | 'medium' | 'low' | 'unmapped';

export function confidenceTier(confidence: number, target: ImportTargetField | null): ConfidenceTier {
  if (!target) return 'unmapped';
  if (confidence >= 0.9) return 'high';
  if (confidence >= 0.7) return 'medium';
  return 'low';
}

function autoMapHeader(header: string): Omit<ColumnMapping, 'sourceColumn' | 'fromSaved'> {
  for (const rule of RULES) {
    if (rule.pattern.test(header)) {
      return { targetField: rule.target, confidence: rule.confidence, reasoning: rule.reasoning };
    }
  }
  return { targetField: null, confidence: 0, reasoning: 'No confident match — set this manually' };
}

// Auto-map a fresh set of headers. Each source column gets at most one target;
// when two columns would claim the same target the later one is dropped to
// `null` so the rep resolves the collision at the confirmation gate.
export function autoMapColumns(headers: string[]): ColumnMapping[] {
  const claimed = new Set<ImportTargetField>();
  return headers.map((raw) => {
    const sourceColumn = raw.trim();
    const guess = autoMapHeader(sourceColumn);
    if (guess.targetField && claimed.has(guess.targetField)) {
      return {
        sourceColumn,
        targetField: null,
        confidence: 0,
        reasoning: `Another column already maps to "${IMPORT_FIELD_LABELS[guess.targetField]}"`,
        fromSaved: false,
      };
    }
    if (guess.targetField) claimed.add(guess.targetField);
    return { sourceColumn, ...guess, fromSaved: false };
  });
}

// Re-apply a previously-saved mapping to a new file's headers. Columns the saved
// mapping recognizes are pinned to their saved target (full confidence); any
// unrecognized columns fall back to the auto-mapper so a changed export still
// resolves. Friction is paid once — this is the "saved/reused mapping" path.
export function applySavedMapping(
  headers: string[],
  savedFields: ImportMappingField[],
): ColumnMapping[] {
  const saved = new Map(savedFields.map((f) => [f.sourceColumn, f.targetField]));
  const auto = autoMapColumns(headers);
  return headers.map((raw, i) => {
    const sourceColumn = raw.trim();
    if (saved.has(sourceColumn)) {
      const targetRaw = saved.get(sourceColumn) ?? null;
      const targetField = isImportTargetField(targetRaw) ? targetRaw : null;
      return {
        sourceColumn,
        targetField,
        confidence: targetField ? 1 : 0,
        reasoning: 'From your saved mapping',
        fromSaved: true,
      };
    }
    return auto[i] ?? { sourceColumn, targetField: null, confidence: 0, reasoning: 'New column', fromSaved: false };
  });
}

function isImportTargetField(value: string | null): value is ImportTargetField {
  return value !== null && (IMPORT_TARGET_FIELDS as readonly string[]).includes(value);
}

// Convert the confirmed in-flight mappings into the persisted ImportMapping
// `fields` shape (M14 saved/reused mapping).
export function toMappingFields(mappings: ColumnMapping[]): ImportMappingField[] {
  return mappings.map((m) => ({ sourceColumn: m.sourceColumn, targetField: m.targetField }));
}
