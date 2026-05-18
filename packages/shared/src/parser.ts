import { z } from 'zod';

// Output of the Opportunity Parser prompt — quick-paste intake. AI must not
// invent values; missing fields stay null.
export const parsedOpportunitySchema = z.object({
  opportunity_name: z.string().nullable(),
  buyer: z.object({
    first_name: z.string().nullable(),
    last_name: z.string().nullable(),
    title: z.string().nullable(),
    company: z.string().nullable(),
    email: z.string().email().nullable(),
    linkedin: z.string().url().nullable(),
  }),
  current_crm_stage: z.string().nullable(),
  opportunity_value: z.number().nullable(),
  expected_close_date: z.string().nullable().describe('ISO 8601 date if extractable'),
  known_pain: z.string().nullable(),
  known_objection: z.string().nullable(),
  deal_notes: z.string().nullable(),
});
export type ParsedOpportunity = z.infer<typeof parsedOpportunitySchema>;

// Output of the CSV Column Mapper — maps the user's headers to our schema.
// `confidence` lets the UI flag low-confidence mappings for user review.
export const csvColumnMappingSchema = z.object({
  mappings: z.array(
    z.object({
      source_column: z.string(),
      target_field: z
        .enum([
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
        ])
        .nullable()
        .describe('null if no good mapping'),
      confidence: z.number().min(0).max(1),
      reasoning: z.string(),
    }),
  ),
});
export type CsvColumnMapping = z.infer<typeof csvColumnMappingSchema>;
