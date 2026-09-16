import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { EMBEDDING_DIMENSIONS } from '../../embeddings/constants.js';
import type { PenalCodeEmbeddingResult } from '../../embeddings/types.js';
import { importCodePenal } from '../import-code-penal.js';
import { LEGAL_CODE_CHUNKS_TABLE } from '../constants.js';
import { verifyCorpusImport } from '../verify-import.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ConfigService } from '@nestjs/config';

function vector(seed: number): number[] {
  return Array.from(
    { length: EMBEDDING_DIMENSIONS },
    (_, i) => seed + i * 0.0001,
  );
}

function makeFixture(): PenalCodeEmbeddingResult {
  return {
    source: {
      chunksFile: 'data/processed/code-penal.chunks.json',
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
        chunkId: '111-1#0',
        articleNumber: '111-1',
        content: 'Premier chunk',
        charCount: 13,
        embedding: vector(1),
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
        chunkId: '111-2#0',
        articleNumber: '111-2',
        content: 'Second chunk',
        charCount: 12,
        embedding: vector(2),
        metadata: {
          articleNumber: '111-2',
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
    ],
  };
}

const databaseUrl = process.env.DATABASE_URL;
const runIntegration = Boolean(databaseUrl) && process.env.RUN_DB_TESTS === 'true';

describe.runIf(runIntegration)('importCodePenal (integration)', () => {
  let prisma: PrismaService;
  let tempDir: string;
  let fixturePath: string;

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

    tempDir = await mkdtemp(join(tmpdir(), 'penal-import-'));
    fixturePath = join(tempDir, 'embeddings.json');
    await writeFile(fixturePath, JSON.stringify(makeFixture()), 'utf-8');
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.$executeRawUnsafe(
        `DELETE FROM ${LEGAL_CODE_CHUNKS_TABLE}
         WHERE corpus_id = $1
           AND chunk_id = ANY($2::text[])`,
        'code-penal',
        ['111-1#0', '111-2#0'],
      );
      await prisma.$disconnect();
    }
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('imports embeddings and remains idempotent on re-import', async () => {
    const first = await importCodePenal(prisma, { embeddingsPath: fixturePath });

    expect(first.stats.inputRecordCount).toBe(2);
    expect(first.verification.totalRows).toBe(2);
    expect(first.verification.invalidDimensionRows).toBe(0);
    expect(first.verification.duplicateCorpusChunkIds).toBe(0);

    const second = await importCodePenal(prisma, { embeddingsPath: fixturePath });

    expect(second.verification.totalRows).toBe(2);
    expect(second.verification.duplicateCorpusChunkIds).toBe(0);

    const verification = await verifyCorpusImport(prisma, 'code-penal');
    expect(verification.totalRows).toBe(2);
    expect(verification.invalidDimensionRows).toBe(0);
  });

  it('reads the fixture from disk', async () => {
    const raw = await readFile(fixturePath, 'utf-8');
    const parsed = JSON.parse(raw) as PenalCodeEmbeddingResult;
    expect(parsed.records).toHaveLength(2);
  });
});
