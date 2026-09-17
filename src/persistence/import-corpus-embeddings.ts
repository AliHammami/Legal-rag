import { resolve } from 'node:path';

import { EMBEDDING_DIMENSIONS } from '../embeddings/constants.js';
import type { CorpusEmbeddedChunk } from '../embeddings/types.js';
import { getCorpusConfig } from '../ingestion/corpus-config.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import {
  corpusEmbeddingsPath,
  IMPORT_BATCH_SIZE,
  IMPORT_TRANSACTION_TIMEOUT_MS,
} from './constants.js';
import { PersistenceError } from './persistence.error.js';
import type { PrismaExecutor } from './prisma-executor.js';
import { readEmbeddingsFileMetadata } from './read-embeddings-metadata.js';
import { streamEmbeddingRecords } from './stream-embedding-records.js';
import { deleteObsoleteCorpusChunks } from './sync-corpus-chunks.js';
import type {
  ImportCorpusOptions,
  ImportResult,
  ImportVerification,
} from './types.js';
import { validateImportRecord } from './validate-import-record.js';
import { upsertChunkBatch } from './upsert-chunks.js';
import { verifyCorpusImport } from './verify-import.js';

function validateCorpusImportResult(
  verification: ImportVerification,
  corpusId: string,
  expectedRecordCount: number,
): void {
  if (verification.invalidDimensionRows > 0) {
    throw new PersistenceError(
      `${verification.invalidDimensionRows} rows have invalid vector dimensions for ${corpusId}`,
      'IMPORT_VERIFICATION_FAILED',
    );
  }

  if (verification.duplicateCorpusChunkIds > 0) {
    throw new PersistenceError(
      `${verification.duplicateCorpusChunkIds} duplicate (corpusId, chunkId) values found for ${corpusId}`,
      'IMPORT_VERIFICATION_FAILED',
    );
  }

  if (verification.totalRows !== expectedRecordCount) {
    throw new PersistenceError(
      `Row count mismatch after import for ${corpusId}: ${verification.totalRows} vs ${expectedRecordCount}`,
      'IMPORT_VERIFICATION_FAILED',
    );
  }
}

async function syncCorpusFromStream(
  prisma: PrismaExecutor,
  corpusId: string,
  embeddingsPath: string,
  embeddingModel: string,
  embeddedAt: Date,
  batchSize: number,
): Promise<{ deletedCount: number; deletedChunkIds: string[]; recordCount: number }> {
  const expectedChunkIds: string[] = [];
  const seenChunkIds = new Set<string>();
  let batch: CorpusEmbeddedChunk[] = [];
  let recordCount = 0;

  for await (const record of streamEmbeddingRecords(embeddingsPath)) {
    validateImportRecord(record, seenChunkIds);
    expectedChunkIds.push(record.chunkId);
    batch.push(record);
    recordCount++;

    if (batch.length >= batchSize) {
      await upsertChunkBatch(
        prisma,
        batch.map((item) => ({
          corpusId,
          record: item,
          embeddingModel,
          embeddedAt,
        })),
      );
      batch = [];
    }
  }

  if (batch.length > 0) {
    await upsertChunkBatch(
      prisma,
      batch.map((item) => ({
        corpusId,
        record: item,
        embeddingModel,
        embeddedAt,
      })),
    );
  }

  const deletion = await deleteObsoleteCorpusChunks(
    prisma,
    corpusId,
    expectedChunkIds,
  );

  const verification = await verifyCorpusImport(prisma, corpusId);
  validateCorpusImportResult(verification, corpusId, recordCount);

  return { ...deletion, recordCount };
}

export async function importCorpusEmbeddings(
  prisma: PrismaService,
  corpusId: string,
  options: ImportCorpusOptions = {},
): Promise<ImportResult> {
  getCorpusConfig(corpusId);

  const startedAt = Date.now();
  const embeddingsPath = resolve(
    options.embeddingsPath ?? corpusEmbeddingsPath(corpusId),
  );
  const batchSize = options.batchSize ?? IMPORT_BATCH_SIZE;

  const metadata = await readEmbeddingsFileMetadata(embeddingsPath);
  if (metadata.config.dimensions !== EMBEDDING_DIMENSIONS) {
    throw new PersistenceError(
      `Unexpected embedding dimensions in file: ${metadata.config.dimensions}`,
      'EMBEDDING_DIMENSIONS_MISMATCH',
    );
  }

  const embeddedAt = new Date(metadata.embeddedAt);
  if (Number.isNaN(embeddedAt.getTime())) {
    throw new PersistenceError(
      `Invalid embeddedAt in embeddings file: ${metadata.embeddedAt}`,
      'EMBEDDED_AT_INVALID',
    );
  }

  const streamResult = await prisma.$transaction(
    async (tx) =>
      syncCorpusFromStream(
        tx as unknown as PrismaExecutor,
        corpusId,
        embeddingsPath,
        metadata.config.model,
        embeddedAt,
        batchSize,
      ),
    {
      maxWait: IMPORT_TRANSACTION_TIMEOUT_MS,
      timeout: IMPORT_TRANSACTION_TIMEOUT_MS,
    },
  );

  if (options.verbose || streamResult.deletedCount > 0) {
    console.log(
      `[${corpusId}] Chunks obsol\u00E8tes supprim\u00E9s : ${streamResult.deletedCount}`,
    );
    if (streamResult.deletedChunkIds.length > 0) {
      console.log(
        `[${corpusId}] chunkIds supprim\u00E9s : ${streamResult.deletedChunkIds.join(', ')}`,
      );
    }
  }

  const verification = await verifyCorpusImport(prisma, corpusId);
  const batchCount = Math.ceil(streamResult.recordCount / batchSize);

  return {
    corpusId,
    source: {
      embeddingsFile: options.embeddingsPath ?? corpusEmbeddingsPath(corpusId),
      embeddedAt: metadata.embeddedAt,
      embeddingModel: metadata.config.model,
    },
    importedAt: new Date().toISOString(),
    stats: {
      inputRecordCount: streamResult.recordCount,
      batchCount,
      deletedCount: streamResult.deletedCount,
      deletedChunkIds: streamResult.deletedChunkIds,
      durationMs: Date.now() - startedAt,
    },
    verification,
  };
}
