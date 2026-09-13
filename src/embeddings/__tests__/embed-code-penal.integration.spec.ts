import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { EMBEDDING_DIMENSIONS } from '../constants.js';
import { embedCodePenal } from '../embed-code-penal.js';
import type { PenalCodeChunkingResult } from '../../chunking/types.js';
import type { OpenAIService } from '../../openai/openai.service.js';

function vector(seed: number): number[] {
  return Array.from({ length: EMBEDDING_DIMENSIONS }, (_, i) => seed + i * 0.0001);
}

function makeFixture(): PenalCodeChunkingResult {
  return {
    source: {
      articlesFile: 'data/processed/code-penal.articles.json',
      articleCount: 2,
    },
    chunkedAt: '2026-01-01T00:00:00.000Z',
    config: { targetSize: 1500, maxSize: 2000 },
    stats: {
      articleCount: 2,
      chunkCount: 3,
      singleChunkArticles: 1,
      multiChunkArticles: 1,
      maxChunkSize: 100,
      avgChunkSize: 50,
      chunksOverMax: 0,
      sentenceSplitUnits: 0,
      hardSplitUnits: 0,
    },
    chunks: [
      {
        chunkId: '111-1#0',
        articleNumber: '111-1',
        content: 'Premier chunk',
        charCount: 13,
        metadata: {
          articleNumber: '111-1',
          pageStart: 1,
          pageEnd: 1,
          source: 'data/code-penal.pdf',
          sourceType: 'pdf',
          chunkIndex: 0,
          chunkCount: 1,
          unitStart: 0,
          unitEnd: 0,
          unitCount: 1,
        },
      },
      {
        chunkId: '131-6#0',
        articleNumber: '131-6',
        content: 'Deuxième chunk',
        charCount: 14,
        metadata: {
          articleNumber: '131-6',
          pageStart: 2,
          pageEnd: 2,
          source: 'data/code-penal.pdf',
          sourceType: 'pdf',
          chunkIndex: 0,
          chunkCount: 2,
          unitStart: 0,
          unitEnd: 1,
          unitCount: 2,
        },
      },
      {
        chunkId: '131-6#1',
        articleNumber: '131-6',
        content: 'Troisième chunk',
        charCount: 15,
        metadata: {
          articleNumber: '131-6',
          pageStart: 2,
          pageEnd: 2,
          source: 'data/code-penal.pdf',
          sourceType: 'pdf',
          chunkIndex: 1,
          chunkCount: 2,
          unitStart: 2,
          unitEnd: 2,
          unitCount: 3,
        },
      },
    ],
  };
}

describe('embedCodePenal (intégration mock OpenAI)', () => {
  let tempDir: string;
  let chunksPath: string;
  let outputPath: string;
  let batchCounter: number;

  const mockOpenAIService = {
    createEmbeddings: vi.fn(),
    getEmbeddingModel: vi.fn(() => 'text-embedding-3-large'),
  } as unknown as OpenAIService;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'embed-test-'));
    chunksPath = join(tempDir, 'chunks.json');
    outputPath = join(tempDir, 'embeddings.json');

    await import('node:fs/promises').then(({ writeFile }) =>
      writeFile(chunksPath, JSON.stringify(makeFixture())),
    );

    batchCounter = 0;
    vi.mocked(mockOpenAIService.createEmbeddings).mockImplementation(
      async (inputs: string[]) => {
        batchCounter++;
        return inputs.map((_, index) => ({
          index,
          embedding: vector(batchCounter * 10 + index),
        }));
      },
    );
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('produit un JSON self-contained avec records et invariants', async () => {
    const result = await embedCodePenal(mockOpenAIService, {
      chunksPath,
      outputPath,
      batchSize: 2,
    });

    expect(result.stats.inputChunkCount).toBe(3);
    expect(result.stats.outputRecordCount).toBe(3);
    expect(result.stats.batchCount).toBe(2);
    expect(result.stats.missingChunks).toBe(0);
    expect(result.stats.duplicateChunkIds).toBe(0);
    expect(result.config.dimensions).toBe(3072);
    expect(result.records).toHaveLength(3);

    expect(result.records[0]!.chunkId).toBe('111-1#0');
    expect(result.records[0]!.content).toBe('Premier chunk');
    expect(result.records[0]!.embedding).toHaveLength(3072);

    const written = JSON.parse(await readFile(outputPath, 'utf-8'));
    expect(written.records).toHaveLength(3);
    expect(mockOpenAIService.createEmbeddings).toHaveBeenCalledTimes(2);
  });

  it('mappe correctement même si l\'API retourne les indices permutés', async () => {
    vi.mocked(mockOpenAIService.createEmbeddings).mockImplementationOnce(
      async (inputs: string[]) => {
        return inputs.map((_, index) => ({
          index: inputs.length - 1 - index,
          embedding: vector(100 + index),
        }));
      },
    );

    const singleBatchOutput = join(tempDir, 'single-batch.json');
    const singleFixture = makeFixture();
    singleFixture.chunks = [singleFixture.chunks[0]!];
    singleFixture.stats.chunkCount = 1;
    const singleChunksPath = join(tempDir, 'single-chunks.json');
    await import('node:fs/promises').then(({ writeFile }) =>
      writeFile(singleChunksPath, JSON.stringify(singleFixture)),
    );

    const result = await embedCodePenal(mockOpenAIService, {
      chunksPath: singleChunksPath,
      outputPath: singleBatchOutput,
      batchSize: 128,
    });

    expect(result.records[0]!.chunkId).toBe('111-1#0');
    expect(result.records[0]!.embedding).toEqual(vector(100));
  });
});
