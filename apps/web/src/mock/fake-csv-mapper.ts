// Mock column-mapper that stands in for the AI csvColumnMappingSchema chain.
// Deterministic pattern-matching based on the source column name — gives a
// confidence score so the UI can flag low-confidence rows for review.

export const TARGET_FIELDS = [
  'opportunity_name',
  'buyer_first_name',
  'buyer_last_name',
  'buyer_title',
  'buyer_company',
  'buyer_email',
  'buyer_linkedin',
  'current_crm_stage',
  'opportunity_value',
  'expected_close_date',
  'known_pain',
  'known_objection',
  'deal_notes',
] as const;

export type TargetField = (typeof TARGET_FIELDS)[number];

interface MappingRule {
  pattern: RegExp;
  target: TargetField;
  confidence: number;
  reasoning: string;
}

const RULES: MappingRule[] = [
  // Strong exact matches first.
  { pattern: /^opportunity[_\s-]?name$|^opp[_\s-]?name$/i, target: 'opportunity_name', confidence: 1, reasoning: 'Exact match for opportunity name' },
  { pattern: /^name$|^deal[_\s-]?name$/i, target: 'opportunity_name', confidence: 0.7, reasoning: 'Generic "name" assumed to be opportunity' },

  { pattern: /^first[_\s-]?name$|^buyer[_\s-]?first/i, target: 'buyer_first_name', confidence: 1, reasoning: 'Column name matches first name' },
  { pattern: /^last[_\s-]?name$|^buyer[_\s-]?last/i, target: 'buyer_last_name', confidence: 1, reasoning: 'Column name matches last name' },
  { pattern: /^title$|^role$|^position$/i, target: 'buyer_title', confidence: 0.95, reasoning: 'Title / role / position column' },
  { pattern: /^company$|^account$|^organization$|^org$/i, target: 'buyer_company', confidence: 1, reasoning: 'Standard company column' },
  { pattern: /^email$|^buyer[_\s-]?email$|e[_\s-]?mail/i, target: 'buyer_email', confidence: 1, reasoning: 'Email column' },
  { pattern: /linkedin/i, target: 'buyer_linkedin', confidence: 0.95, reasoning: 'Contains "linkedin"' },

  { pattern: /^stage$|^crm[_\s-]?stage$|^pipeline[_\s-]?stage$/i, target: 'current_crm_stage', confidence: 1, reasoning: 'CRM pipeline stage column' },

  { pattern: /^value$|^amount$|^arr$|^deal[_\s-]?value$/i, target: 'opportunity_value', confidence: 0.95, reasoning: 'Deal value column' },
  { pattern: /^close[_\s-]?date$|^expected[_\s-]?close|^closing[_\s-]?date$/i, target: 'expected_close_date', confidence: 1, reasoning: 'Expected close date' },

  { pattern: /pain/i, target: 'known_pain', confidence: 0.9, reasoning: 'Column references "pain"' },
  { pattern: /objection|risk|blocker/i, target: 'known_objection', confidence: 0.85, reasoning: 'Column references objection / risk' },
  { pattern: /notes?$|comment|description/i, target: 'deal_notes', confidence: 0.8, reasoning: 'Free-text notes column' },
];

export interface ColumnMapping {
  source_column: string;
  target_field: TargetField | null;
  confidence: number;
  reasoning: string;
}

export function fakeMapCsvColumns(headers: string[]): ColumnMapping[] {
  return headers.map((header) => {
    const trimmed = header.trim();
    for (const rule of RULES) {
      if (rule.pattern.test(trimmed)) {
        return {
          source_column: trimmed,
          target_field: rule.target,
          confidence: rule.confidence,
          reasoning: rule.reasoning,
        };
      }
    }
    return {
      source_column: trimmed,
      target_field: null,
      confidence: 0,
      reasoning: 'No confident match — review manually',
    };
  });
}
