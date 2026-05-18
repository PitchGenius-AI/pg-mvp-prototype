import { signalExtractionSchema, type SignalExtraction } from '@pg/shared';
import type { AnthropicClient } from '../client';
import { generateStructured } from '../generate-structured';
import { MODELS } from '../models';

const SYSTEM = `You extract readiness signals from sales interaction evidence.

A signal is a discrete observation from the source — a quote, a paraphrase, or a
checklist item — that constitutes evidence about ONE of the five buyer-readiness
dimensions (pain, trust, urgency, solution_confidence, commitment) or about risk.

Hard rules:
1. NEVER invent buyer quotes. Every signal must cite text that actually appears
   in the transcript/notes, or a checklist item the rep ticked.
2. Separate transcript-attributed evidence ("source": "transcript") from the rep's
   subjective notes ("source": "rep_note") and checklist items ("source": "checklist").
3. Rate strength: weak (oblique/passing), medium (clear but qualified), strong
   (explicit, unambiguous).
4. Absent evidence matters. If a dimension has no signals, list what's missing in
   "missing_evidence" (e.g. "no urgency statement after multiple probes").
5. Risk signals capture things working AGAINST the deal (objection, vagueness,
   going dark, competitor preference).
`;

export interface SignalExtractorInput {
  productName: string;
  productDescription: string;
  targetBuyer: string;
  problemSolved: string;
  interactionType: string;
  transcriptOrNotes: string | null;
  repSubjectiveNotes: string | null;
  checklist: {
    nextStepAgreed: boolean;
    stakeholderAdded: boolean;
    pricingDiscussed: boolean;
    budgetDiscussed: boolean;
    competitorDiscussed: boolean;
    implementationDiscussed: boolean;
    securityDiscussed: boolean;
  };
}

export async function extractSignals(
  client: AnthropicClient,
  input: SignalExtractorInput,
): Promise<SignalExtraction> {
  const userMsg = [
    `## Product context`,
    `Name: ${input.productName}`,
    `Description: ${input.productDescription}`,
    `Target buyer: ${input.targetBuyer}`,
    `Problem solved: ${input.problemSolved}`,
    ``,
    `## Interaction (${input.interactionType})`,
    ``,
    `### Transcript / notes`,
    input.transcriptOrNotes ?? '(none)',
    ``,
    `### Rep subjective notes`,
    input.repSubjectiveNotes ?? '(none)',
    ``,
    `### Checklist (rep ticked these)`,
    Object.entries(input.checklist)
      .filter(([, v]) => v)
      .map(([k]) => `- ${k}`)
      .join('\n') || '(none)',
  ].join('\n');

  return generateStructured({
    client,
    model: MODELS.signalExtraction,
    system: SYSTEM,
    user: userMsg,
    schema: signalExtractionSchema,
    schemaName: 'signal_extraction',
    maxTokens: 8192,
  });
}
