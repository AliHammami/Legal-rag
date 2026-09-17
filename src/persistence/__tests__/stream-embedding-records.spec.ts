import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { EMBEDDING_DIMENSIONS } from '../../embeddings/constants.js';
import { streamEmbeddingRecords } from '../stream-embedding-records.js';

function vector(seed: number): number[] {
  return Array.from(
    { length: EMBEDDING_DIMENSIONS },
    (_, index) => seed + index * 0.0001,
  );
}

function makeRecord(chunkId: string) {
  const content = `Content for ${chunkId}`;
  return {
    corpusId: 'test-corpus',
    chunkId,
    articleNumber: chunkId,
    content,
    charCount: content.length,
    embedding: vector(1),
    metadata: {
      articleNumber: chunkId,
      pageStart: 1,
      pageEnd: 1,
      source: 'test.pdf',
      sourceType: 'pdf',
      chunkIndex: 0,
      chunkCount: 1,
      unitStart: 0,
      unitEnd: 0,
      unitCount: 1,
    },
  };
}

async function countRecords(path: string): Promise<number> {
  let count = 0;
  for await (const _record of streamEmbeddingRecords(path)) {
    count++;
  }
  return count;
}

describe('streamEmbeddingRecords', () => {
  it('lit un fichier compact multi-records', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'stream-emb-'));
    const filePath = join(tempDir, 'sample.embeddings.json');
    const records = [makeRecord('a#0'), makeRecord('b#0')];
    const body = {
      corpusId: 'test-corpus',
      embeddedAt: '2026-01-01T00:00:00.000Z',
      config: {
        model: 'text-embedding-3-large',
        dimensions: EMBEDDING_DIMENSIONS,
        batchSize: 128,
      },
      records,
    };

    await writeFile(
      filePath,
      `{${[
        '"corpusId":"test-corpus"',
        '"embeddedAt":"2026-01-01T00:00:00.000Z"',
        '"config":' + JSON.stringify(body.config),
        '"records":[' + records.map((record) => JSON.stringify(record)).join(',') + ']',
      ].join(',')}}`,
    );

    try {
      expect(await countRecords(filePath)).toBe(2);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('lit le Code penal (format pretty-printed)', async () => {
    const count = await countRecords('data/processed/code-penal.embeddings.json');
    expect(count).toBe(1367);
  }, 120_000);
});
