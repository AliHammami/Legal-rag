import { EMBEDDING_DIMENSIONS } from '../embeddings/constants.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { LEGAL_CODE_CHUNKS_TABLE } from './constants.js';
import type {
  CorpusPersistenceValidation,
  PersistenceValidationReport,
} from './types.js';
import { verifyGlobalImport } from './verify-import.js';

interface CorpusValidationRow {
  corpus_id: string;
  row_count: number | bigint;
  unique_corpus_chunk_ids: number | bigint;
  duplicate_corpus_chunk_ids: number | bigint;
  rows_missing_content: number | bigint;
  rows_missing_embeddings: number | bigint;
  rows_with_embeddings: number | bigint;
  invalid_dimension_rows: number | bigint;
  embedding_models: string[] | null;
}

export async function validateCorpusPersistence(
  prisma: PrismaService,
  corpusId: string,
  expectedDimensions: number = EMBEDDING_DIMENSIONS,
): Promise<CorpusPersistenceValidation> {
  const [row] = await prisma.$queryRawUnsafe<CorpusValidationRow[]>(
    `SELECT
       corpus_id,
       COUNT(*)::int AS row_count,
       COUNT(DISTINCT chunk_id)::int AS unique_corpus_chunk_ids,
       (COUNT(*) - COUNT(DISTINCT chunk_id))::int AS duplicate_corpus_chunk_ids,
       COUNT(*) FILTER (WHERE content IS NULL OR btrim(content) = '')::int AS rows_missing_content,
       COUNT(*) FILTER (WHERE embedding IS NULL)::int AS rows_missing_embeddings,
       COUNT(*) FILTER (WHERE embedding IS NOT NULL)::int AS rows_with_embeddings,
       COUNT(*) FILTER (
         WHERE embedding IS NOT NULL
           AND vector_dims(embedding) <> $2
       )::int AS invalid_dimension_rows,
       ARRAY_REMOVE(ARRAY_AGG(DISTINCT embedding_model), NULL) AS embedding_models
     FROM ${LEGAL_CODE_CHUNKS_TABLE}
     WHERE corpus_id = $1
     GROUP BY corpus_id`,
    corpusId,
    expectedDimensions,
  );

  return {
    corpusId,
    rowCount: Number(row?.row_count ?? 0),
    uniqueCorpusChunkIds: Number(row?.unique_corpus_chunk_ids ?? 0),
    duplicateCorpusChunkIds: Number(row?.duplicate_corpus_chunk_ids ?? 0),
    rowsMissingContent: Number(row?.rows_missing_content ?? 0),
    rowsMissingEmbeddings: Number(row?.rows_missing_embeddings ?? 0),
    rowsWithEmbeddings: Number(row?.rows_with_embeddings ?? 0),
    invalidDimensionRows: Number(row?.invalid_dimension_rows ?? 0),
    embeddingModels: row?.embedding_models ?? [],
  };
}

export async function validatePersistence(
  prisma: PrismaService,
  corpusIds: readonly string[],
  expectedDimensions: number = EMBEDDING_DIMENSIONS,
): Promise<PersistenceValidationReport> {
  const [global, corpora] = await Promise.all([
    verifyGlobalImport(prisma, expectedDimensions),
    Promise.all(
      corpusIds.map((corpusId) =>
        validateCorpusPersistence(prisma, corpusId, expectedDimensions),
      ),
    ),
  ]);

  return { global, corpora };
}
