import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { EMBEDDING_DIMENSIONS } from '../embeddings/constants.js';
import type { PenalCodeEmbeddingResult } from '../embeddings/types.js';
import {
  validateEmbeddingVector,
  validateInputChunks,
} from '../embeddings/validate-embeddings.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import {
  DEFAULT_EMBEDDINGS_FILE,
  IMPORT_BATCH_SIZE,
} from './constants.js';
import { PersistenceError } from './persistence.error.js';
import type {
  ImportCodePenalOptions,
  ImportResult,
} from './types.js';
import { upsertChunkBatch } from './upsert-chunks.js';
import { verifyImport } from './verify-import.js';

export async function importCodePenal(
  prisma: PrismaService,
  options: ImportCodePenalOptions = {},
): Promise<ImportResult> {
  const startedAt = Date.now();
  const embeddingsPath = resolve(options.embeddingsPath ?? DEFAULT_EMBEDDINGS_FILE);
  const batchSize = options.batchSize ?? IMPORT_BATCH_SIZE;

  let embeddingResult: PenalCodeEmbeddingResult;
  try {
    embeddingResult = JSON.parse(
      await readFile(embeddingsPath, 'utf-8'),
    ) as PenalCodeEmbeddingResult;
  } catch (error) {
    throw new PersistenceError(
      `Unable to read embeddings file: ${embeddingsPath}`,
      'EMBEDDINGS_FILE_INVALID',
      error,
    );
  }

  if (embeddingResult.config.dimensions !== EMBEDDING_DIMENSIONS) {
    throw new PersistenceError(
      `Unexpected embedding dimensions in file: ${embeddingResult.config.dimensions}`,
      'EMBEDDING_DIMENSIONS_MISMATCH',
    );
  }

  const records = embeddingResult.records;
  validateInputChunks(
    records.map((record) => ({
      chunkId: record.chunkId,
      articleNumber: record.articleNumber,
      content: record.content,
      charCount: record.charCount,
      metadata: record.metadata,
    })),
  );

  for (const record of records) {
    validateEmbeddingVector(record.embedding, record.chunkId);
  }

  const embeddedAt = new Date(embeddingResult.embeddedAt);
  if (Number.isNaN(embeddedAt.getTime())) {
    throw new PersistenceError(
      `Invalid embeddedAt in embeddings file: ${embeddingResult.embeddedAt}`,
      'EMBEDDED_AT_INVALID',
    );
  }

  const batchCount = Math.ceil(records.length / batchSize);

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    await upsertChunkBatch(
      prisma,
      batch.map((record) => ({
        record,
        embeddingModel: embeddingResult.config.model,
        embeddedAt,
      })),
    );
  }

  const verification = await verifyImport(prisma);

  if (verification.invalidDimensionRows > 0) {
    throw new PersistenceError(
      `${verification.invalidDimensionRows} rows have invalid vector dimensions`,
      'IMPORT_VERIFICATION_FAILED',
    );
  }

  if (verification.duplicateChunkIds > 0) {
    throw new PersistenceError(
      `${verification.duplicateChunkIds} duplicate chunk_id values found`,
      'IMPORT_VERIFICATION_FAILED',
    );
  }

  if (verification.totalRows !== records.length) {
    throw new PersistenceError(
      `Row count mismatch after import: ${verification.totalRows} vs ${records.length}`,
      'IMPORT_VERIFICATION_FAILED',
    );
  }

  return {
    source: {
      embeddingsFile: options.embeddingsPath ?? DEFAULT_EMBEDDINGS_FILE,
      embeddedAt: embeddingResult.embeddedAt,
      embeddingModel: embeddingResult.config.model,
    },
    importedAt: new Date().toISOString(),
    stats: {
      inputRecordCount: records.length,
      batchCount,
      durationMs: Date.now() - startedAt,
    },
    verification,
  };
}
