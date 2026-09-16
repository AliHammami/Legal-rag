import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { EMBEDDING_DIMENSIONS } from '../embeddings/constants.js';
import type { PenalCodeEmbeddingResult } from '../embeddings/types.js';
import {
  validateEmbeddingVector,
  validateInputChunks,
} from '../embeddings/validate-embeddings.js';
import { getCorpusConfig } from '../ingestion/corpus-config.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import {
  corpusEmbeddingsPath,
  IMPORT_BATCH_SIZE,
} from './constants.js';
import { PersistenceError } from './persistence.error.js';
import type { ImportCorpusOptions, ImportResult } from './types.js';
import { upsertChunkBatch } from './upsert-chunks.js';
import { verifyCorpusImport } from './verify-import.js';

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
        corpusId,
        record,
        embeddingModel: embeddingResult.config.model,
        embeddedAt,
      })),
    );
  }

  const verification = await verifyCorpusImport(prisma, corpusId);

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

  if (verification.totalRows !== records.length) {
    throw new PersistenceError(
      `Row count mismatch after import for ${corpusId}: ${verification.totalRows} vs ${records.length}`,
      'IMPORT_VERIFICATION_FAILED',
    );
  }

  return {
    corpusId,
    source: {
      embeddingsFile: options.embeddingsPath ?? corpusEmbeddingsPath(corpusId),
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
