// Centralized model choices per prompt chain so we can tune cost/quality in one place.
// Update these as new model IDs ship.

export const MODELS = {
  // Diagnosis is the flagship product output — quality matters most.
  diagnosis: 'claude-opus-4-7' as const,
  // Signal extraction reads long transcripts; Sonnet balances cost and quality.
  signalExtraction: 'claude-sonnet-4-6' as const,
  // Lightweight parsing tasks.
  opportunityParser: 'claude-haiku-4-5-20251001' as const,
  csvMapper: 'claude-haiku-4-5-20251001' as const,
  // Website-profile extraction reads page text and pulls a few fields.
  websiteExtractor: 'claude-haiku-4-5-20251001' as const,
  // Pre-call intelligence (DISC/OCEAN + technique + script) — reasoning-heavier.
  precall: 'claude-sonnet-4-6' as const,
};

export type ModelChoice = (typeof MODELS)[keyof typeof MODELS];
