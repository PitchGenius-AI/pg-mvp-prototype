import { csvColumnMappingSchema, type CsvColumnMapping } from '@pg/shared';
import type { AnthropicClient } from '../client';
import { generateStructured } from '../generate-structured';
import { MODELS } from '../models';

const SYSTEM = `You map arbitrary CSV column headers to the Pitch Genius opportunity schema.

For each source column, decide which target field it maps to (or null if none fits).
Provide a confidence score 0-1 and a one-sentence reasoning. The user reviews
your suggestions before any data is committed, so be precise rather than aggressive:
when uncertain, prefer null + low confidence over a wrong guess.

Target fields and what they mean:
- opportunity_name: deal/account/opportunity title
- buyer_first_name / buyer_last_name / buyer_title: the person on the buyer side
- buyer_company: company name
- buyer_email / buyer_linkedin
- current_crm_stage: pipeline stage label
- opportunity_value: dollar amount
- expected_close_date
- known_pain / known_objection / deal_notes: free-text rep context
`;

export async function mapCsvColumns(
  client: AnthropicClient,
  headers: string[],
  sampleRows: string[][],
): Promise<CsvColumnMapping> {
  const preview = [headers.join(','), ...sampleRows.slice(0, 5).map((r) => r.join(','))].join('\n');
  return generateStructured({
    client,
    model: MODELS.csvMapper,
    system: SYSTEM,
    user: `Headers: ${headers.join(', ')}\n\nFirst 5 rows preview:\n${preview}`,
    schema: csvColumnMappingSchema,
    schemaName: 'csv_column_mapping',
    maxTokens: 2048,
  });
}
