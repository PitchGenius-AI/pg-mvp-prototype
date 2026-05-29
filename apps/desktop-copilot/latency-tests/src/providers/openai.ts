import { createReadStream } from 'node:fs';
import OpenAI from 'openai';

export function makeOpenAI(apiKey: string): OpenAI {
  return new OpenAI({ apiKey });
}

// Streamed chat completion. Fires onFirstToken on the first non-empty content
// delta so the caller can capture first-token-on-screen relative to chunk arrival.
export async function streamChat(opts: {
  client: OpenAI;
  model: string;
  system: string;
  user: string;
  maxTokens?: number;
  onFirstToken?: () => void;
  signal?: AbortSignal;
}): Promise<{ text: string }> {
  const stream = await opts.client.chat.completions.create(
    {
      model: opts.model,
      stream: true,
      max_tokens: opts.maxTokens ?? 80,
      messages: [
        { role: 'system', content: opts.system },
        { role: 'user', content: opts.user },
      ],
    },
    { signal: opts.signal },
  );
  let text = '';
  let firstSeen = false;
  for await (const part of stream) {
    const delta = part.choices[0]?.delta?.content ?? '';
    if (delta) {
      if (!firstSeen) {
        firstSeen = true;
        opts.onFirstToken?.();
      }
      text += delta;
    }
  }
  return { text };
}

// Non-streamed completion for the naive baseline's intermediate steps
// (evidence extraction, scoring, technique decision).
export async function completeChat(opts: {
  client: OpenAI;
  model: string;
  system: string;
  user: string;
  maxTokens?: number;
  signal?: AbortSignal;
}): Promise<string> {
  const resp = await opts.client.chat.completions.create(
    {
      model: opts.model,
      max_tokens: opts.maxTokens ?? 200,
      messages: [
        { role: 'system', content: opts.system },
        { role: 'user', content: opts.user },
      ],
    },
    { signal: opts.signal },
  );
  return resp.choices[0]?.message?.content ?? '';
}

// Whole-file transcription (interim Deepgram proxy). Measures request->transcript
// latency; it is NOT streaming partials, so it understates how a real streaming
// STT would feed the critical path. Flagged as such in the decision doc.
export async function transcribeFile(opts: {
  client: OpenAI;
  model: string;
  audioPath: string;
  signal?: AbortSignal;
}): Promise<string> {
  const resp = await opts.client.audio.transcriptions.create(
    {
      model: opts.model,
      file: createReadStream(opts.audioPath),
    },
    { signal: opts.signal },
  );
  return resp.text;
}
