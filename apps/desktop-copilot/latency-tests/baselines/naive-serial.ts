import type OpenAI from 'openai';
import { GENERATION_MODELS, TRANSCRIBE_MODEL, WORKHORSE_MODEL, requireKey } from '../src/config';
import { audioPathFor, loadChunks } from '../src/fixtures';
import {
  buildExtractionMessages,
  buildGenerationMessages,
  buildScoringMessages,
  buildTechniqueMessages,
} from '../src/prompt';
import type { Pipeline } from '../src/pipeline';
import { completeChat, makeOpenAI, streamChat, transcribeFile } from '../src/providers/openai';
import { runSet } from '../src/run-set';
import type { TranscriptChunk } from '../src/types';

const GEN = GENERATION_MODELS.openai!;

// Naive serial baseline: transcription -> evidence extraction -> scoring ->
// technique decision -> generation, ALL on the critical path, single model.
// This is intentionally the slow version — its first-token number is the
// "do nothing clever" baseline the decoupled pipeline is measured against.
export function makeNaiveSerialPipeline(client: OpenAI): Pipeline {
  return {
    architecture: 'naive-serial',
    model: GEN.label,
    async run(ctx) {
      const { chunk, collector, audioPath } = ctx;
      try {
        // 1. Transcription (audio -> chunk text). Measured; result not threaded
        //    downstream because the fixture text is equivalent in size and keeps
        //    the prompt deterministic across runs.
        if (audioPath) {
          await collector.phase('transcription', () =>
            transcribeFile({ client, model: TRANSCRIBE_MODEL, audioPath }),
          );
        }

        // 2. Evidence extraction.
        const evidence = await collector.phase('evidence_extraction', () => {
          const m = buildExtractionMessages(chunk);
          return completeChat({ client, model: WORKHORSE_MODEL, system: m.system, user: m.user, maxTokens: 200 });
        });

        // 3. Readiness re-score.
        const scores = await collector.phase('scoring', () => {
          const m = buildScoringMessages(chunk, evidence);
          return completeChat({ client, model: WORKHORSE_MODEL, system: m.system, user: m.user, maxTokens: 150 });
        });

        // 4. Technique decision.
        await collector.phase('technique_decision', () => {
          const m = buildTechniqueMessages(chunk, scores);
          return completeChat({ client, model: WORKHORSE_MODEL, system: m.system, user: m.user, maxTokens: 60 });
        });

        // 5. Generation (streamed; first content delta == first-token-on-screen).
        let firstTokenOnScreenMs: number | null = null;
        const gen = buildGenerationMessages(chunk);
        const { text } = await collector.phase('generation', () =>
          streamChat({
            client,
            model: GEN.model,
            system: gen.system,
            user: gen.user,
            maxTokens: 60,
            onFirstToken: () => {
              firstTokenOnScreenMs = collector.msSinceArrival();
            },
          }),
        );
        const fullPromptMs = collector.msSinceArrival();

        return {
          firstTokenOnScreenMs,
          fullPromptMs,
          criticalPathTotalMs: fullPromptMs,
          backgroundRefreshMs: null,
          generatedText: text,
          ok: true,
        };
      } catch (err) {
        return {
          firstTokenOnScreenMs: null,
          fullPromptMs: null,
          criticalPathTotalMs: null,
          backgroundRefreshMs: null,
          generatedText: '',
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
  };
}

function numArg(name: string): number | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (!hit) return undefined;
  const n = Number(hit.split('=')[1]);
  return Number.isFinite(n) ? n : undefined;
}

async function main(): Promise<void> {
  const apiKey = requireKey('OPENAI_API_KEY');
  const client = makeOpenAI(apiKey);

  const repeat = numArg('repeat') ?? 5; // 20 chunks x 5 = 100 runs (spec 2.2)
  const limit = numArg('limit'); // optional: first N chunks (for smoke runs)

  let chunks = await loadChunks();
  if (limit != null) chunks = chunks.slice(0, limit);

  // Per-repeat perturbation so identical prompts don't get unrealistic cache hits.
  const perturb = (chunk: TranscriptChunk, r: number): TranscriptChunk =>
    r === 0 ? chunk : { ...chunk, text: `${chunk.text} (rep ${r})` };

  const summary = await runSet({
    pipeline: makeNaiveSerialPipeline(client),
    chunks,
    repeat,
    perturb,
    audioPathFor,
    onProgress: (done, total, res) => {
      const ft = res.firstTokenOnScreenMs == null ? 'FAIL' : `${Math.round(res.firstTokenOnScreenMs)}ms`;
      process.stdout.write(`\r  ${done}/${total}  last first-token=${ft}        `);
    },
  });

  process.stdout.write('\n');
  console.log(`\nnaive-serial: ${summary.ok}/${summary.total} ok, ${summary.failed} failed`);
  console.log(`results -> ${summary.resultsPath}`);
  console.log(`summarize with: pnpm summary "${summary.resultsPath}"`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
