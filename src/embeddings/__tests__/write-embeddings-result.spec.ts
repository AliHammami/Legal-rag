import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { EMBEDDING_DIMENSIONS } from '../constants.js';
import type { CorpusEmbeddingResult } from '../types.js';
import { writeEmbeddingsResultAtomically } from '../write-embeddings-result.js';

describe('writeEmbeddingsResultAtomically', () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'embed-write-test-'));
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('ecrit un JSON relisible avec plusieurs records', async () => {
    const outputPath = join(tempDir, 'output.embeddings.json');
    const embedding = Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0.1);
    const result: CorpusEmbeddingResult = {
      corpusId: 'code-civil',
      source: {
        corpusId: 'code-civil',
        chunksFile: 'data/processed/code-civil.chunks.json',
        chunkCount: 2,
      },
      embeddedAt: '2026-01-01T00:00:00.000Z',
      config: {
        model: 'text-embedding-3-large',
        dimensions: EMBEDDING_DIMENSIONS,
        batchSize: 128,
      },
      stats: {
        inputChunkCount: 2,
        outputRecordCount: 2,
        batchCount: 1,
        durationMs: 1,
        missingChunks: 0,
        duplicateChunkIds: 0,
      },
      records: [
        {
          corpusId: 'code-civil',
          chunkId: '1#0',
          articleNumber: '1',
          content: 'A',
          charCount: 1,
          embedding,
          metadata: {
            articleNumber: '1',
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
        },
        {
          corpusId: 'code-civil',
          chunkId: '2#0',
          articleNumber: '2',
          content: 'B',
          charCount: 1,
          embedding,
          metadata: {
            articleNumber: '2',
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
        },
      ],
    };

    await writeEmbeddingsResultAtomically(outputPath, result);
    const parsed = JSON.parse(await readFile(outputPath, 'utf-8'));
    expect(parsed.corpusId).toBe('code-civil');
    expect(parsed.records).toHaveLength(2);
    expect(parsed.records[0]!.chunkId).toBe('1#0');
  });
});
