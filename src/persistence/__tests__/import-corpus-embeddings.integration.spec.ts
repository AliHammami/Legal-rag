import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { EMBEDDING_DIMENSIONS } from '../../embeddings/constants.js';
import type { PenalCodeEmbeddingResult } from '../../embeddings/types.js';
import { importCorpusEmbeddings } from '../import-corpus-embeddings.js';
import { LEGAL_CODE_CHUNKS_TABLE } from '../constants.js';
import { verifyCorpusImport } from '../verify-import.js';
import { PrismaService } from '../../prisma/prisma.service.js';

function vector(seed: number): number[] {
  return Array.from(
    { length: EMBEDDING_DIMENSIONS },
    (_, i) => seed + i * 0.0001,
  );
}

function makeFixture(
  chunkId: string,
  articleNumber: string,
  seed: number,
): PenalCodeEmbeddingResult['records'][number] {
  return {
    chunkId,
    articleNumber,
    content: `Content for ${chunkId}`,
    charCount: 20,
    embedding: vector(seed),
    metadata: {
      articleNumber,
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

function makeEmbeddingFile(
  records: PenalCodeEmbeddingResult['records'],
): PenalCodeEmbeddingResult {
  return {
    source: {
      chunksFile: 'test.chunks.json',
      chunkCount: records.length,
    },
    embeddedAt: '2026-01-01T00:00:00.000Z',
    config: {
      model: 'text-embedding-3-large',
      dimensions: EMBEDDING_DIMENSIONS,
      batchSize: 128,
    },
    stats: {
      inputChunkCount: records.length,
      outputRecordCount: records.length,
      batchCount: 1,
      durationMs: 1,
      missingChunks: 0,
      duplicateChunkIds: 0,
    },
    records,
  };
}

const databaseUrl = process.env.DATABASE_URL;
const runIntegration = Boolean(databaseUrl) && process.env.RUN_DB_TESTS === 'true';

describe.runIf(runIntegration)('importCorpusEmbeddings (integration)', () => {
  let prisma: PrismaService;
  let tempDir: string;

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
    tempDir = await mkdtemp(join(tmpdir(), 'legal-import-'));
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.$executeRawUnsafe(
        `DELETE FROM ${LEGAL_CODE_CHUNKS_TABLE}
         WHERE corpus_id = ANY($1::text[])
           AND chunk_id = ANY($2::text[])`,
        ['code-penal', 'code-civil'],
        ['122-5#0', '111-1#0', '111-2#0'],
      );
      await prisma.$disconnect();
    }
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('allows the same chunkId in different corpora', async () => {
    const sharedChunkId = '122-5#0';
    const penalPath = join(tempDir, 'code-penal.embeddings.json');
    const civilPath = join(tempDir, 'code-civil.embeddings.json');

    await writeFile(
      penalPath,
      JSON.stringify(
        makeEmbeddingFile([makeFixture(sharedChunkId, '122-5', 1)]),
      ),
      'utf-8',
    );
    await writeFile(
      civilPath,
      JSON.stringify(
        makeEmbeddingFile([makeFixture(sharedChunkId, '122-5', 2)]),
      ),
      'utf-8',
    );

    await importCorpusEmbeddings(prisma, 'code-penal', {
      embeddingsPath: penalPath,
    });
    await importCorpusEmbeddings(prisma, 'code-civil', {
      embeddingsPath: civilPath,
    });

    const penal = await verifyCorpusImport(prisma, 'code-penal');
    const civil = await verifyCorpusImport(prisma, 'code-civil');

    expect(penal.totalRows).toBe(1);
    expect(civil.totalRows).toBe(1);
    expect(penal.duplicateCorpusChunkIds).toBe(0);
    expect(civil.duplicateCorpusChunkIds).toBe(0);
  });

  it('remains idempotent when importing the same corpus twice', async () => {
    const fixturePath = join(tempDir, 'penal-idempotent.embeddings.json');
    await writeFile(
      fixturePath,
      JSON.stringify(
        makeEmbeddingFile([
          makeFixture('111-1#0', '111-1', 3),
          makeFixture('111-2#0', '111-2', 4),
        ]),
      ),
      'utf-8',
    );

    const first = await importCorpusEmbeddings(prisma, 'code-penal', {
      embeddingsPath: fixturePath,
    });
    const second = await importCorpusEmbeddings(prisma, 'code-penal', {
      embeddingsPath: fixturePath,
    });

    expect(first.stats.inputRecordCount).toBe(2);
    expect(second.verification.totalRows).toBe(2);
    expect(second.verification.duplicateCorpusChunkIds).toBe(0);

    const raw = await readFile(fixturePath, 'utf-8');
    expect(JSON.parse(raw).records).toHaveLength(2);
  });
});
