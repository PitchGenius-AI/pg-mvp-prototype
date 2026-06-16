// Stage 2 — Resolve: the crux of enrichment. The same name is often
// many different people; this stage clusters raw search evidence into DISTINCT
// candidate persons and scores each. Separation-biased, low temperature,
// schema-enforced. It does NOT write the final profile (that's Stage 3) — it only
// decides who the distinct people are and which sources belong to each.

import { z } from 'zod';
import type { AnthropicClient } from '../client';
import { generateStructured } from '../generate-structured';
import { MODELS } from '../models';
import { ENRICH_TEMPS } from './config';
import type { MergedEvidence, ProviderTextResult, SearchQuery } from './types';

const SYSTEM = `You disambiguate web search evidence about a person into DISTINCT candidate people.

The hard truth of this task: the same name is frequently several different real people. Your job is to separate them, not merge them.

Rules:
- BIAS TOWARD SEPARATION. Different specialization, company, seniority, location, or a distinct LinkedIn profile ⇒ SEPARATE candidates. Merge two sources into one candidate ONLY on strong identity match (same name AND consistent role/company/context). Over-merging silently fabricates a person who doesn't exist — the worst possible failure.
- Score each candidate's CONFIDENCE 0–100 that it is one coherent real person matching the query: 85–100 strong, 70–84 good, 50–69 moderate, <50 weak.
- Every candidate must cite the source indices that support it. Use ONLY the provided indices; never invent a source.
- "Rejected" means spam, broken, or irrelevant sources ONLY. A source describing a DIFFERENT real person with the same name is NOT rejected — it becomes (or joins) another candidate.
- Ground every judgment in the provided evidence. Do not use outside knowledge to assert facts about the person.
- Order candidates by confidence, highest first.`;

const resolveCandidateSchema = z.object({
  label: z
    .string()
    .describe('Human-readable disambiguator, e.g. "Jane Doe — VP Sales at Acme (San Francisco)"'),
  confidence: z.number().int().min(0).max(100),
  reasoning: z.string().describe('Why these sources are one distinct person matching the query'),
  sourceIndices: z
    .array(z.number().int())
    .describe('Indices (from the numbered evidence list) that support this candidate'),
});

const resolveOutputSchema = z.object({
  candidates: z.array(resolveCandidateSchema),
  rejectedIndices: z
    .array(z.number().int())
    .describe('Indices that are spam/broken/irrelevant ONLY — not different-person sources'),
});

export interface ResolvedCandidate {
  label: string;
  confidence: number;
  reasoning: string;
  sources: ProviderTextResult[];
}

function buildUserMessage(evidence: MergedEvidence, query: SearchQuery): string {
  const lines: string[] = [];
  lines.push('## Identity signal (what we are looking for)');
  lines.push(`Query: ${query.text}`);
  const s = query.signal;
  const known = [
    s.name && `name: ${s.name}`,
    s.role && `role: ${s.role}`,
    s.company && `company: ${s.company}`,
    s.email && `email: ${s.email}`,
    s.linkedinUrl && `linkedin: ${s.linkedinUrl}`,
    s.country && `country: ${s.country}`,
  ].filter(Boolean);
  if (known.length) lines.push(known.join('; '));

  if (evidence.answers.length) {
    lines.push('\n## Synthesized provider summaries');
    evidence.answers.forEach((a, i) => lines.push(`(${i + 1}) ${a}`));
  }

  lines.push('\n## Evidence sources (cite these by index)');
  if (evidence.textResults.length === 0) {
    lines.push('(none)');
  } else {
    evidence.textResults.forEach((r, i) => {
      lines.push(`[${i}] ${r.title}\n    url: ${r.url}${r.snippet ? `\n    ${r.snippet}` : ''}`);
    });
  }
  return lines.join('\n');
}

// Resolve the merged evidence into ranked candidate people. Maps each candidate's
// source indices back to the actual sources (bounds-checked — a hallucinated index
// is simply dropped). Returns [] when there is no usable evidence.
export async function resolveCandidates(
  client: AnthropicClient,
  evidence: MergedEvidence,
  query: SearchQuery,
): Promise<ResolvedCandidate[]> {
  if (evidence.textResults.length === 0 && evidence.answers.length === 0) {
    return [];
  }

  const output = await generateStructured({
    client,
    model: MODELS.enrichResolve,
    system: SYSTEM,
    user: buildUserMessage(evidence, query),
    schema: resolveOutputSchema,
    schemaName: 'enrichment_resolution',
    temperature: ENRICH_TEMPS.resolve,
    maxTokens: 4096,
  });

  return output.candidates
    .map((c) => ({
      label: c.label,
      confidence: c.confidence,
      reasoning: c.reasoning,
      sources: c.sourceIndices
        .map((idx) => evidence.textResults[idx])
        .filter((r): r is ProviderTextResult => r !== undefined),
    }))
    .sort((a, b) => b.confidence - a.confidence);
}
