import { z } from 'zod';

// Lead-enrichment contract (PG-288, Increment 1). The Manual Entry intake starts
// from a single identity signal — an email or a LinkedIn URL — and the server
// runs a 5-stage pipeline (normalize → search → resolve → structure) that returns
// ranked *candidate people*, each scored for confidence. The rep picks one (or it
// auto-fills on a single strong match) to pre-fill the buyer form.
//
// The crux of enrichment is that the same name is often several real people, so
// "resolving" (picking a candidate) is modelled as a first-class, deferrable step:
// the single-lead flow resolves inline, and the future bulk-CSV flow (Increment 2)
// reuses this exact contract to resolve asynchronously in a review queue.
//
// This reverses the no-network mock at apps/web/src/mock/fake-enrich.ts and ports
// the domain logic from the prior codebase's lead-enrichment implementation. The real chains live in packages/ai alongside the diagnosis chains.

// The two front doors a single-lead enrichment can start from. Both normalize to
// the same internal SearchQuery (a LinkedIn URL just derives structured fields),
// so this is the entry-point label, not a separate pipeline.
export const enrichSources = ['email', 'linkedin'] as const;
export const enrichSourceSchema = z.enum(enrichSources);
export type EnrichSource = z.infer<typeof enrichSourceSchema>;

// Confidence tiers for a resolved candidate. A consumer gates on these — a single
// `strong` candidate auto-fills; anything more ambiguous is shown for the rep to
// pick. Thresholds match the Resolve prompt's bands.
export const enrichConfidenceTiers = ['strong', 'good', 'moderate', 'weak'] as const;
export const enrichConfidenceTierSchema = z.enum(enrichConfidenceTiers);
export type EnrichConfidenceTier = z.infer<typeof enrichConfidenceTierSchema>;

// score 0–100 → tier. Single source of truth so the prompt, the API, and the UI
// never drift on what "strong" means.
export function enrichConfidenceTier(score: number): EnrichConfidenceTier {
  if (score >= 85) return 'strong';
  if (score >= 70) return 'good';
  if (score >= 50) return 'moderate';
  return 'weak';
}

// The buyer fields enrichment can populate — exactly the columns on buyerSchema
// (entities.ts), so a resolved candidate maps straight onto the intake form.
// Anything the evidence can't ground is null (e.g. a domain scrape can't know an
// individual's title) and the rep fills it in.
export const enrichedBuyerFieldsSchema = z.object({
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  title: z.string().nullable(),
  company: z.string().nullable(),
  email: z.string().nullable(),
  linkedin: z.string().nullable(),
  website: z.string().nullable(),
});
export type EnrichedBuyerFields = z.infer<typeof enrichedBuyerFieldsSchema>;

// A citation carried through to the UI so a human can verify what the enrichment
// is grounded in. Enrichment without provenance is unaccountable.
export const enrichSourceCitationSchema = z.object({
  title: z.string(),
  url: z.string(),
  snippet: z.string().nullable(),
});
export type EnrichSourceCitation = z.infer<typeof enrichSourceCitationSchema>;

// One distinct candidate person the search evidence clustered into. Ranked by
// confidence; the consumer (rep inline, or the bulk review queue) decides.
export const enrichmentCandidateSchema = z.object({
  // Stable within a single result so the chooser can key on it.
  id: z.string(),
  // Human-readable disambiguator, e.g. "Jane Doe — VP Sales, Acme".
  label: z.string(),
  confidence: z.number().int().min(0).max(100),
  confidenceTier: enrichConfidenceTierSchema,
  reasoning: z.string().describe('Why the evidence points to this being one distinct person'),
  // The buyer-form pre-fill for this candidate.
  fields: enrichedBuyerFieldsSchema,
  summary: z.string().describe('Short grounded read of who this person is'),
  imageUrl: z.string().nullable(),
  sources: z.array(enrichSourceCitationSchema),
});
export type EnrichmentCandidate = z.infer<typeof enrichmentCandidateSchema>;

// Per-provider success flag for the search fan-out — surfaced so the caller knows
// the result came from degraded evidence (e.g. only one provider answered).
export const enrichProviderStatusSchema = z.object({
  name: z.string(),
  ok: z.boolean(),
});
export type EnrichProviderStatus = z.infer<typeof enrichProviderStatusSchema>;

// The full result of a single-lead enrichment. `candidates` is ranked desc by
// confidence and may be empty (no usable evidence) — the UI then falls back to
// manual entry, same as the old mock's miss path.
export const enrichmentResultSchema = z.object({
  source: enrichSourceSchema,
  // The normalized query the search stage actually ran (echoed for transparency).
  query: z.string(),
  candidates: z.array(enrichmentCandidateSchema),
  providers: z.array(enrichProviderStatusSchema),
});
export type EnrichmentResult = z.infer<typeof enrichmentResultSchema>;

// tRPC input for the single-lead path. `country` (optional, ISO-ish) drives the
// per-request search locale — never hardcode a region. When absent the
// router falls back to the workspace's configured locale.
export const enrichmentRequestSchema = z.object({
  source: enrichSourceSchema,
  value: z.string().min(1),
  country: z.string().nullable().optional(),
});
export type EnrichmentRequest = z.infer<typeof enrichmentRequestSchema>;
