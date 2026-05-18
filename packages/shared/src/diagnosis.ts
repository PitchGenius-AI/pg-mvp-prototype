import { z } from 'zod';
import {
  alignmentLevelSchema,
  alignmentOutcomeSchema,
  confidenceLevelSchema,
  readinessStateSchema,
  signalDimensionSchema,
} from './enums';

// Per-dimension scoring output.
export const dimensionScoreSchema = z.object({
  dimension: signalDimensionSchema.exclude(['risk']),
  score: z.number().int().min(0).max(100),
  evidence: z.array(z.string()).describe('Quotes / paraphrases backing the score'),
  diagnosis: z.string().describe('Short narrative explaining where this dimension stands'),
});
export type DimensionScore = z.infer<typeof dimensionScoreSchema>;

// Pipeline Reality Check structured output (spec §Pipeline Reality Check).
export const pipelineRealityCheckSchema = z.object({
  crm_stage: z.string(),
  readiness_state: readinessStateSchema,
  outcome: alignmentOutcomeSchema,
  level: alignmentLevelSchema,
  reason: z.string(),
});
export type PipelineRealityCheck = z.infer<typeof pipelineRealityCheckSchema>;

// Full output of the Buyer Readiness Diagnosis Generator.
export const readinessDiagnosisSchema = z.object({
  readiness_state: readinessStateSchema,
  readiness_score: z.number().int().min(0).max(100),
  confidence_level: confidenceLevelSchema,
  dimension_scores: z.array(dimensionScoreSchema).length(5),
  primary_blocker: z.string().nullable(),
  secondary_blocker: z.string().nullable(),
  pipeline_reality_check: pipelineRealityCheckSchema,
  recommended_next_action: z.string(),
  what_not_to_do_yet: z.array(z.string()),
  follow_up_email: z.object({
    subject: z.string(),
    body: z.string(),
  }),
  manager_coaching_note: z.string(),
});
export type ReadinessDiagnosis = z.infer<typeof readinessDiagnosisSchema>;
