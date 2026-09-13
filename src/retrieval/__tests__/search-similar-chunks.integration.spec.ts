import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { EMBEDDING_DIMENSIONS } from '../../embeddings/constants.js';
import { upsertChunkBatch } from '../../persistence/upsert-chunks.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { searchSimilarChunks } from '../search-similar-chunks.js';

const databaseUrl = process.env.DATABASE_URL;
const runIntegration = Boolean(databaseUrl) && process.env.RUN_DB_TESTS === 'true';

const TEST_CHUNK_IDS = ['retrieval-test-a#0', 'retrieval-test-b#0', 'retrieval-test-c#0'];

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
        record: makeRecord(TEST_CHUNK_IDS[0], 'ret-a', queryVector),
        embeddingModel: 'text-embedding-3-large',
        embeddedAt,
      },
      {
        record: makeRecord(TEST_CHUNK_IDS[1], 'ret-b', queryVector),
        embeddingModel: 'text-embedding-3-large',
        embeddedAt,
      },
      {
        record: makeRecord(TEST_CHUNK_IDS[2], 'ret-c', vector(99)),
        embeddingModel: 'text-embedding-3-large',
        embeddedAt,
      },
    ]);
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.$executeRawUnsafe(
        `DELETE FROM penal_code_chunks WHERE chunk_id = ANY($1::text[])`,
        TEST_CHUNK_IDS,
      );
      await prisma.$disconnect();
    }
  });

  it('returns topK results ordered by cosine distance with identical vectors near zero', async () => {
    const results = await searchSimilarChunks(prisma, queryVector, 2);

    expect(results).toHaveLength(2);
    expect(results[0]?.distance).toBeLessThan(0.0001);
    expect(results[1]?.distance).toBeLessThan(0.0001);
    expect(
      [results[0]?.chunkId, results[1]?.chunkId].sort(),
    ).toEqual([TEST_CHUNK_IDS[0], TEST_CHUNK_IDS[1]].sort());

    for (let i = 1; i < results.length; i++) {
      expect(results[i]!.distance).toBeGreaterThanOrEqual(results[i - 1]!.distance);
    }
  });

  it('respects LIMIT topK', async () => {
    const results = await searchSimilarChunks(prisma, queryVector, 1);
    expect(results).toHaveLength(1);
  });
});
