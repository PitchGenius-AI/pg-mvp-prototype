import { access, mkdir, writeFile } from 'node:fs/promises';
import OpenAI from 'openai';
import { AUDIO_DIR, requireKey } from '../src/config';
import { audioPathFor, loadChunks } from '../src/fixtures';

// Generates one spoken MP3 per transcript chunk via OpenAI TTS, so the real
// Deepgram streaming step (Epics 2-3) has audio input. Idempotent: existing
// files are skipped, so it's safe to re-run after adding chunks.
async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const apiKey = requireKey('OPENAI_API_KEY');
  const client = new OpenAI({ apiKey });
  const chunks = await loadChunks();
  await mkdir(AUDIO_DIR, { recursive: true });

  let made = 0;
  let skipped = 0;
  for (const chunk of chunks) {
    const out = audioPathFor(chunk);
    if (await fileExists(out)) {
      skipped++;
      continue;
    }
    const resp = await client.audio.speech.create({
      model: 'tts-1',
      voice: 'alloy',
      input: chunk.text,
      response_format: 'mp3',
    });
    const buf = Buffer.from(await resp.arrayBuffer());
    await writeFile(out, buf);
    made++;
    console.log(`  ${chunk.id}  ${buf.length} bytes`);
  }
  console.log(`\nDone: ${made} generated, ${skipped} skipped -> ${AUDIO_DIR}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
