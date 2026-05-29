import os from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';

const here = dirname(fileURLToPath(import.meta.url)); // .../latency-tests/src
export const LATENCY_TESTS_DIR = resolve(here, '..'); // .../latency-tests
export const REPO_ROOT = resolve(here, '../../../..'); // pg-mvp-2
export const RESULTS_DIR = resolve(LATENCY_TESTS_DIR, 'results');
export const FIXTURES_DIR = resolve(LATENCY_TESTS_DIR, 'fixtures');
export const AUDIO_DIR = resolve(FIXTURES_DIR, 'audio');

// The harness reads keys from the repo-root .env so it shares config with the rest of the monorepo.
loadDotenv({ path: resolve(REPO_ROOT, '.env') });

type KeyName = 'OPENAI_API_KEY' | 'PERPLEXITY_API_KEY' | 'DEEPGRAM_API_KEY';

// Real provider calls only — fail loudly (never silently mock) when a key is absent.
export function requireKey(name: KeyName): string {
  const envPath = resolve(REPO_ROOT, '.env');
  const v = process.env[name]?.trim();
  if (!v) {
    throw new Error(
      `Missing ${name}. The latency harness makes real provider calls only — ` +
        `add a valid ${name} to ${envPath} before running this step.`,
    );
  }
  if (v.includes('...')) {
    throw new Error(
      `${name} in ${envPath} still looks like the placeholder (it contains "..."). ` +
        `Replace it with a real key. Note: if ${name} appears on more than one line, ` +
        `dotenv keeps the FIRST occurrence — delete the placeholder line.`,
    );
  }
  return v;
}

export function machineId(): string {
  const override = process.env.LATENCY_MACHINE_ID?.trim();
  if (override) return override;
  return `${os.hostname()}-${os.platform()}-${os.arch()}`;
}

export interface ModelConfig {
  id: string;
  provider: 'openai' | 'perplexity';
  model: string;
  label: string; // recorded in results
}

// Critical-path generation candidates. OpenAI is also the baseline/optimized
// workhorse; Perplexity is the Epic-4 comparison model. (Anthropic + Gemini were
// dropped per the provider decision — see PG-250.)
export const GENERATION_MODELS: Record<string, ModelConfig> = {
  openai: { id: 'openai', provider: 'openai', model: 'gpt-4o-mini', label: 'openai:gpt-4o-mini' },
  perplexity: { id: 'perplexity', provider: 'perplexity', model: 'sonar', label: 'perplexity:sonar' },
};

// A run-start network sample is taken against this host so results carry the
// network conditions they were measured under.
export const PING_ENDPOINT = process.env.LATENCY_PING_ENDPOINT?.trim() || 'https://api.openai.com';

// Interim transcription model (Deepgram proxy — whole-file, not streaming).
// whisper-1 is the universally-available fallback if the account lacks the
// gpt-4o transcribe models.
export const TRANSCRIBE_MODEL = process.env.LATENCY_TRANSCRIBE_MODEL?.trim() || 'gpt-4o-mini-transcribe';

// The single model the naive baseline uses for every generative step.
export const WORKHORSE_MODEL = 'gpt-4o-mini';
