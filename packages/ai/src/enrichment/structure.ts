// Stage 3 — Structure: turn ONE resolved candidate's evidence into a
// typed buyer profile. One candidate → one call; the orchestrator runs these in
// parallel with a concurrency cap and tolerates per-candidate failure.
//
// Grounding is non-negotiable: extract only, never invent. Every field must trace
// to a provided source, else it is null and the rep fills it in.

import { z } from 'zod';
import { enrichedBuyerFieldsSchema, type EnrichedBuyerFields } from '@pg/shared';
import type { AnthropicClient } from '../client';
import { generateStructured } from '../generate-structured';
import { MODELS } from '../models';
import { ENRICH_TEMPS } from './config';
import { scrubField } from './normalize';
import type { ResolvedCandidate } from './resolve';
import type { SearchQuery } from './types';

const SYSTEM = `You turn the verified evidence about ONE person into a structured buyer profile.

Rules:
- EXTRACT ONLY. Never invent a name, title, company, or URL. If the evidence does not support a field, return null for it — do not guess.
- Every non-null field must be grounded in the provided sources for THIS person. Ignore sources about other people.
- firstName/lastName: split the person's name. title: their current role/title. company: their current employer. website: the employer's website if present in a source. email/linkedin: only if a source contains them.
- summary: 1–2 sentences on who this person is professionally, grounded in the sources. No speculation.`;

const structureOutputSchema = enrichedBuyerFieldsSchema.extend({
  summary: z.string().describe('1–2 grounded sentences on who this person is'),
});

export interface StructuredProfile {
  fields: EnrichedBuyerFields;
  summary: string;
}

function buildUserMessage(candidate: ResolvedCandidate, query: SearchQuery): string {
  const lines: string[] = [];
  lines.push('## Person to profile');
  lines.push(candidate.label);
  lines.push(`Resolver reasoning: ${candidate.reasoning}`);
  if (query.signal.country) lines.push(`Likely country: ${query.signal.country}`);

  lines.push('\n## Verified sources for THIS person');
  if (candidate.sources.length === 0) {
    lines.push('(no sources — return mostly nulls)');
  } else {
    candidate.sources.forEach((r, i) => {
      lines.push(`[${i}] ${r.title}\n    url: ${r.url}${r.snippet ? `\n    ${r.snippet}` : ''}`);
    });
  }
  return lines.join('\n');
}

export async function structureCandidate(
  client: AnthropicClient,
  candidate: ResolvedCandidate,
  query: SearchQuery,
): Promise<StructuredProfile> {
  const output = await generateStructured({
    client,
    model: MODELS.enrichStructure,
    system: SYSTEM,
    user: buildUserMessage(candidate, query),
    schema: structureOutputSchema,
    schemaName: 'enrichment_profile',
    temperature: ENRICH_TEMPS.structure,
    maxTokens: 1024,
  });

  const { summary, ...rawFields } = output;
  // Models sometimes emit the literal string "null"/"unknown"/"n/a" instead of a
  // real JSON null for a field they can't ground. Scrub every field through the
  // same sentinel filter the search query uses so those never reach the form.
  const fields: EnrichedBuyerFields = {
    firstName: scrubField(rawFields.firstName),
    lastName: scrubField(rawFields.lastName),
    title: scrubField(rawFields.title),
    company: scrubField(rawFields.company),
    email: scrubField(rawFields.email),
    linkedin: scrubField(rawFields.linkedin),
    website: scrubField(rawFields.website),
  };
  return { fields, summary };
}
