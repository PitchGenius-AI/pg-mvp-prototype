import { websiteExtractionSchema, type WebsiteExtraction } from '@pg/shared';
import type { AnthropicClient } from '../client';
import { generateStructured } from '../generate-structured';
import { MODELS } from '../models';

const SYSTEM = `You extract a B2B company's sales profile from the text of their website.

From the page text, identify:
- industry — the market the company operates in
- products — the products or services they sell (best-effort; one short description each)
- targetCustomer — who they sell to (the ideal customer profile)
- coreProblem — the core problem they solve for that customer

Rules:
- Ground every field in the page text. Do NOT invent products or markets that are not
  supported by the content.
- If the page is thin, a login wall, an error page, or clearly not a company site,
  return empty/short values rather than fabricating — the caller treats a weak result
  as "manual entry".
- Keep descriptions to one sentence; keep targetCustomer and coreProblem concise.`;

export async function extractWebsiteProfile(
  client: AnthropicClient,
  pageText: string,
): Promise<WebsiteExtraction> {
  return generateStructured({
    client,
    model: MODELS.websiteExtractor,
    system: SYSTEM,
    user: `## Website text\n\n${pageText}`,
    schema: websiteExtractionSchema,
    schemaName: 'website_extraction',
    maxTokens: 2048,
  });
}
