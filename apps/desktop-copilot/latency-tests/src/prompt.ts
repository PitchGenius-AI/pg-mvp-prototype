import type { TranscriptChunk } from './types';

export interface GenerationMessages {
  system: string;
  user: string;
}

// The representative critical-path generation prompt from the latency spec. It
// carries the cached per-opportunity context (maintained by background workers)
// but deliberately does NOT do scoring inline — that is the whole point of the
// decoupled architecture under test.
export function buildGenerationMessages(chunk: TranscriptChunk): GenerationMessages {
  const s = chunk.state;
  const system =
    `You are a real-time sales co-pilot. The rep is on a live call. Based on the latest ` +
    `transcript chunk from the buyer, produce ONE short suggested next response (<=30 words) ` +
    `in the ${s.matchedTechnique} style. The response should advance the call toward ${s.readinessStateGoal}.`;
  const user =
    `User context (cached, updated by background workers):\n` +
    `- Matched technique: ${s.matchedTechnique}\n` +
    `- Current readiness state: ${s.readinessState}\n` +
    `- Last suggested prompt: ${s.lastPrompt}\n` +
    `- Key buyer evidence so far: ${s.evidenceSummary}\n\n` +
    `Latest transcript chunk from buyer:\n${chunk.text}\n\n` +
    `Respond with the single best next thing for the rep to say. No preamble.`;
  return { system, user };
}

// The naive-serial baseline (Epic 2) runs these intermediate steps on the
// critical path before generation. The exact outputs don't matter for latency —
// what matters is that they are real, representative-size model calls that the
// rep would otherwise wait on. The decoupled pipeline (Epic 3) moves them off
// the critical path into background workers.

export function buildExtractionMessages(chunk: TranscriptChunk): GenerationMessages {
  return {
    system:
      `You extract buyer evidence from a live sales-call transcript chunk. Output a terse JSON ` +
      `array of {dimension, signal, strength} where dimension is one of ` +
      `pain|trust|urgency|solution_confidence|commitment|risk and strength is weak|medium|strong. No prose.`,
    user: `Current readiness state: ${chunk.state.readinessState}\nTranscript chunk:\n${chunk.text}`,
  };
}

export function buildScoringMessages(chunk: TranscriptChunk, evidence: string): GenerationMessages {
  return {
    system:
      `You re-score buyer readiness. Given the evidence, output terse JSON ` +
      `{pain,trust,urgency,solution_confidence,commitment,risk} each 0-100, plus overall 0-100. No prose.`,
    user: `Current state: ${chunk.state.readinessState}\nEvidence:\n${evidence}`,
  };
}

export function buildTechniqueMessages(chunk: TranscriptChunk, scores: string): GenerationMessages {
  return {
    system:
      `You pick the best sales technique for the next turn. Output terse JSON ` +
      `{technique: challenger|spin|nepq, confidence: 0-1, reweight: boolean}. No prose.`,
    user: `Current technique: ${chunk.state.matchedTechnique}\nScores:\n${scores}\nChunk:\n${chunk.text}`,
  };
}
