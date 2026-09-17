import { createWriteStream } from 'node:fs';
import { mkdir, rename } from 'node:fs/promises';
import { dirname } from 'node:path';
import { finished } from 'node:stream/promises';

import type { CorpusEmbeddedChunk, CorpusEmbeddingResult } from './types.js';

/**
 * Ecrit le resultat sans JSON.stringify global (limite V8 sur les gros corpus).
 */
export async function writeEmbeddingsResultAtomically(
  outputPath: string,
  result: CorpusEmbeddingResult,
): Promise<void> {
  const tempPath = `${outputPath}.tmp.${process.pid}`;
  await mkdir(dirname(outputPath), { recursive: true });

  const stream = createWriteStream(tempPath, { encoding: 'utf-8' });

  const write = (chunk: string) => {
    if (!stream.write(chunk)) {
      return new Promise<void>((resolve) => stream.once('drain', resolve));
    }
    return Promise.resolve();
  };

  await write('{');
  await write(`"corpusId":${JSON.stringify(result.corpusId)},`);
  await write(`"source":${JSON.stringify(result.source)},`);
  await write(`"embeddedAt":${JSON.stringify(result.embeddedAt)},`);
  await write(`"config":${JSON.stringify(result.config)},`);
  await write(`"stats":${JSON.stringify(result.stats)},`);
  await write('"records":[');

  for (let index = 0; index < result.records.length; index++) {
    if (index > 0) {
      await write(',');
    }
    await write(serializeRecord(result.records[index]!));
  }

  await write(']}');
  stream.end();
  await finished(stream);
  await rename(tempPath, outputPath);
}

function serializeRecord(record: CorpusEmbeddedChunk): string {
  return JSON.stringify(record);
}
