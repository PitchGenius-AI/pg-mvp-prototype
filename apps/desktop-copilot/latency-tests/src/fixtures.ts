import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { AUDIO_DIR, FIXTURES_DIR } from './config';
import type { TranscriptChunk } from './types';

export async function loadChunks(): Promise<TranscriptChunk[]> {
  const path = resolve(FIXTURES_DIR, 'transcript-chunks.json');
  return JSON.parse(await readFile(path, 'utf8')) as TranscriptChunk[];
}

export function audioPathFor(chunk: TranscriptChunk): string {
  return resolve(AUDIO_DIR, `${chunk.id}.mp3`);
}
