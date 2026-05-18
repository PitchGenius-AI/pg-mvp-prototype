import { z } from 'zod';
import {
  signalDimensionSchema,
  signalSourceSchema,
  signalStrengthSchema,
} from './enums';

// Output contract for the Readiness Signal Extractor prompt chain.
// Each signal must point at a quote/paraphrase in the source — no inventions.

export const signalSchema = z.object({
  signal: z.string().min(1).describe('Short description of the observation'),
  evidence: z.string().min(1).describe('Direct quote or close paraphrase from the source'),
  source: signalSourceSchema,
  strength: signalStrengthSchema,
  dimension: signalDimensionSchema,
});
export type Signal = z.infer<typeof signalSchema>;

export const signalExtractionSchema = z.object({
  pain: z.array(signalSchema),
  trust: z.array(signalSchema),
  urgency: z.array(signalSchema),
  solution_confidence: z.array(signalSchema),
  commitment: z.array(signalSchema),
  risk: z.array(signalSchema),
  // Explicit missing-evidence callouts (absence is itself a signal).
  missing_evidence: z.array(z.string()),
});
export type SignalExtraction = z.infer<typeof signalExtractionSchema>;
