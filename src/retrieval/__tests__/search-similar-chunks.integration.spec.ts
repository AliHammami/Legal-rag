import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { EMBEDDING_DIMENSIONS } from '../../embeddings/constants.js';
import {
  DEFAULT_CODE_PENAL_CORPUS_ID,
  LEGAL_CODE_CHUNKS_TABLE,
} from '../../persistence/constants.js';
import { upsertChunkBatch } from '../../persistence/upsert-chunks.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { searchSimilarChunks } from '../search-similar-chunks.js';

const databaseUrl = process.env.DATABASE_URL;
const runIntegration = Boolean(databaseUrl) && process.env.RUN_DB_TESTS === 'true';

const TEST_CHUNK_IDS = {
  penal: ['retrieval-test-penal-a#0', 'retrieval-test-penal-b#0'],
  civil: ['retrieval-test-civil-a#0', 'retrieval-test-civil-b#0'],
  other: ['retrieval-test-penal-c#0'],
};

function vector(seed: number): number[] {
  return Array.from({ length: EMBEDDING_DIMENSIONS }, (_, i) => seed + i * 0.0001);
}

function makeRecord(chunkId: string, articleNumber: string, embedding: number[]) {
  return {
    chunkId,
    articleNumber,
    content: `Retrieval test content for ${chunkId}`,
    charCount: 30,
    embedding,
    metadata: {
      articleNumber,
      pageStart: 1,
      pageEnd: 1,
      source: 'test',
      sourceType: 'pdf' as const,
      chunkIndex: 0,
      chunkCount: 1,
      unitStart: 0,
      unitEnd: 0,
      unitCount: 1,
    },
  };
}

describe.runIf(runIntegration)('searchSimilarChunks (integration)', () => {
  let prisma: PrismaService;
  const queryVector = vector(1);
  const embeddedAt = new Date('2026-01-01T00:00:00.000Z');

  beforeAll(async () => {
    const configService = {
      getOrThrow: (key: string) => {
        if (key === 'DATABASE_URL') {
          return databaseUrl!;
        }
        throw new Error(`Missing config: ${key}`);
      },
      get: () => undefined,
    } as unknown as ConfigService;

    prisma = new PrismaService(configService);
    await prisma.$connect();

    await upsertChunkBatch(prisma, [
      {
        corpusId: DEFAULT_CODE_PENAL_CORPUS_ID,
        record: makeRecord(TEST_CHUNK_IDS.penal[0]!, 'ret-penal-a', queryVector),
        embeddingModel: 'text-embedding-3-large',
        embeddedAt,
      },
      {
        corpusId: DEFAULT_CODE_PENAL_CORPUS_ID,
        record: makeRecord(TEST_CHUNK_IDS.penal[1]!, 'ret-penal-b', queryVector),
        embeddingModel: 'text-embedding-3-large',
        embeddedAt,
      },
      {
        corpusId: DEFAULT_CODE_PENAL_CORPUS_ID,
        record: makeRecord(TEST_CHUNK_IDS.other[0]!, 'ret-penal-c', vector(99)),
        embeddingModel: 'text-embedding-3-large',
        embeddedAt,
      },
      {
        corpusId: 'code-civil',
        record: makeRecord(TEST_CHUNK_IDS.civil[0]!, 'ret-civil-a', vector(50)),
        embeddingModel: 'text-embedding-3-large',
        embeddedAt,
      },
      {
        corpusId: 'code-civil',
        record: makeRecord(TEST_CHUNK_IDS.civil[1]!, 'ret-civil-b', vector(51)),
        embeddingModel: 'text-embedding-3-large',
        embeddedAt,
      },
    ]);
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.$executeRawUnsafe(
        `DELETE FROM ${LEGAL_CODE_CHUNKS_TABLE}
         WHERE chunk_id = ANY($1::text[])`,
        [
          ...TEST_CHUNK_IDS.penal,
          ...TEST_CHUNK_IDS.civil,
          ...TEST_CHUNK_IDS.other,
        ],
      );
      await prisma.$disconnect();
    }
  });

  it('returns code-penal results only when filtered', async () => {
    const results = await searchSimilarChunks(prisma, queryVector, 5, {
      corpusIds: [DEFAULT_CODE_PENAL_CORPUS_ID],
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results.every((result) => result.corpusId === DEFAULT_CODE_PENAL_CORPUS_ID)).toBe(
      true,
    );
    expect(results.some((result) => result.chunkId === TEST_CHUNK_IDS.penal[0])).toBe(
      true,
    );
  });

  it('returns code-civil results only when filtered', async () => {
    const civilVector = vector(50);
    const results = await searchSimilarChunks(prisma, civilVector, 5, {
      corpusIds: ['code-civil'],
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results.every((result) => result.corpusId === 'code-civil')).toBe(true);
    expect(results.some((result) => result.chunkId === TEST_CHUNK_IDS.civil[0])).toBe(
      true,
    );
  });

  it('returns a global topK across multiple corpora', async () => {
    const results = await searchSimilarChunks(prisma, queryVector, 3, {
      corpusIds: [DEFAULT_CODE_PENAL_CORPUS_ID, 'code-civil'],
    });

    expect(results.length).toBeLessThanOrEqual(3);
    expect(
      results.every((result) =>
        [DEFAULT_CODE_PENAL_CORPUS_ID, 'code-civil'].includes(result.corpusId),
      ),
    ).toBe(true);
  });

  it('can search all corpora without a corpus filter', async () => {
    const results = await searchSimilarChunks(prisma, queryVector, 10);

    expect(results.length).toBeLessThanOrEqual(10);
    expect(results.length).toBeGreaterThan(0);
    expect(new Set(results.map((result) => result.corpusId)).size).toBeGreaterThan(0);
  });

  it('respects LIMIT topK', async () => {
    const results = await searchSimilarChunks(prisma, queryVector, 1, {
      corpusIds: [DEFAULT_CODE_PENAL_CORPUS_ID],
    });
    expect(results).toHaveLength(1);
  });

  it('orders results by ascending cosine distance', async () => {
    const results = await searchSimilarChunks(prisma, queryVector, 5, {
      corpusIds: [DEFAULT_CODE_PENAL_CORPUS_ID],
    });

    for (let i = 1; i < results.length; i++) {
      expect(results[i]!.distance).toBeGreaterThanOrEqual(results[i - 1]!.distance);
    }
  });
});
