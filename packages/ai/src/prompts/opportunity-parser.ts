import { parsedOpportunitySchema, type ParsedOpportunity } from '@pg/shared';
import type { AnthropicClient } from '../client';
import { generateStructured } from '../generate-structured';
import { MODELS } from '../models';

const SYSTEM = `You parse rough sales deal notes into structured opportunity records.

Hard rules:
- NEVER invent values. If a field is not clearly present in the input, set it to null.
- Do not guess at email addresses, LinkedIn URLs, dates, or dollar amounts.
- Preserve the rep's wording for free-text fields (known_pain, known_objection, deal_notes).
- For dates, only emit ISO 8601 (YYYY-MM-DD) if the date is unambiguous in the input.
`;

export async function parseOpportunity(
  client: AnthropicClient,
  pastedText: string,
): Promise<ParsedOpportunity> {
  return generateStructured({
    client,
    model: MODELS.opportunityParser,
    system: SYSTEM,
    user: `Parse this into a structured opportunity:\n\n${pastedText}`,
    schema: parsedOpportunitySchema,
    schemaName: 'parsed_opportunity',
    maxTokens: 1024,
  });
}
