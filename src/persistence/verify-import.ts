import { EMBEDDING_DIMENSIONS } from '../embeddings/constants.js';
import type { PrismaExecutor } from './prisma-executor.js';
import { LEGAL_CODE_CHUNKS_TABLE } from './constants.js';
import type {
  GlobalImportVerification,
  ImportVerification,
} from './types.js';

interface CountRow {
  count: number | bigint;
}

interface CorpusCountRow {
  corpus_id: string;
  row_count: number | bigint;
  rows_with_embeddings: number | bigint;
}

export async function verifyCorpusImport(
  prisma: PrismaExecutor,
  corpusId: string,
  expectedDimensions: number = EMBEDDING_DIMENSIONS,
): Promise<ImportVerification> {
  const [
    totalRowsResult,
    rowsWithEmbeddingsResult,
    invalidDimensionRowsResult,
    duplicateCorpusChunkIdsResult,
  ] = await Promise.all([
    prisma.$queryRawUnsafe<CountRow[]>(
      `SELECT COUNT(*)::int AS count
       FROM ${LEGAL_CODE_CHUNKS_TABLE}
       WHERE corpus_id = $1`,
      corpusId,
    ),
    prisma.$queryRawUnsafe<CountRow[]>(
      `SELECT COUNT(*)::int AS count
       FROM ${LEGAL_CODE_CHUNKS_TABLE}
       WHERE corpus_id = $1
         AND embedding IS NOT NULL`,
      corpusId,
    ),
    prisma.$queryRawUnsafe<CountRow[]>(
      `SELECT COUNT(*)::int AS count
       FROM ${LEGAL_CODE_CHUNKS_TABLE}
       WHERE corpus_id = $1
         AND embedding IS NOT NULL
         AND vector_dims(embedding) <> $2`,
      corpusId,
      expectedDimensions,
    ),
    prisma.$queryRawUnsafe<CountRow[]>(
      `SELECT (COUNT(*) - COUNT(DISTINCT chunk_id))::int AS count
       FROM ${LEGAL_CODE_CHUNKS_TABLE}
       WHERE corpus_id = $1`,
      corpusId,
    ),
  ]);

  const totalRows = Number(totalRowsResult[0]?.count ?? 0);
  const rowsWithEmbeddings = Number(rowsWithEmbeddingsResult[0]?.count ?? 0);

  return {
    corpusId,
    totalRows,
    rowsWithEmbeddings,
    rowsMissingEmbeddings: totalRows - rowsWithEmbeddings,
    invalidDimensionRows: Number(invalidDimensionRowsResult[0]?.count ?? 0),
    duplicateCorpusChunkIds: Number(
      duplicateCorpusChunkIdsResult[0]?.count ?? 0,
    ),
  };
}

export async function verifyGlobalImport(
  prisma: PrismaExecutor,
  expectedDimensions: number = EMBEDDING_DIMENSIONS,
): Promise<GlobalImportVerification> {
  const [
    totalRowsResult,
    rowsWithEmbeddingsResult,
    invalidDimensionRowsResult,
    duplicateCorpusChunkIdsResult,
    corpusCountsResult,
  ] = await Promise.all([
    prisma.$queryRawUnsafe<CountRow[]>(
      `SELECT COUNT(*)::int AS count FROM ${LEGAL_CODE_CHUNKS_TABLE}`,
    ),
    prisma.$queryRawUnsafe<CountRow[]>(
      `SELECT COUNT(*)::int AS count
       FROM ${LEGAL_CODE_CHUNKS_TABLE}
       WHERE embedding IS NOT NULL`,
    ),
    prisma.$queryRawUnsafe<CountRow[]>(
      `SELECT COUNT(*)::int AS count
       FROM ${LEGAL_CODE_CHUNKS_TABLE}
       WHERE embedding IS NOT NULL
         AND vector_dims(embedding) <> $1`,
      expectedDimensions,
    ),
    prisma.$queryRawUnsafe<CountRow[]>(
      `SELECT (COUNT(*) - COUNT(DISTINCT (corpus_id, chunk_id)))::int AS count
       FROM ${LEGAL_CODE_CHUNKS_TABLE}`,
    ),
    prisma.$queryRawUnsafe<CorpusCountRow[]>(
      `SELECT
         corpus_id,
         COUNT(*)::int AS row_count,
         COUNT(*) FILTER (WHERE embedding IS NOT NULL)::int AS rows_with_embeddings
       FROM ${LEGAL_CODE_CHUNKS_TABLE}
       GROUP BY corpus_id
       ORDER BY corpus_id`,
    ),
  ]);

  const totalRows = Number(totalRowsResult[0]?.count ?? 0);
  const totalEmbeddings = Number(rowsWithEmbeddingsResult[0]?.count ?? 0);

  return {
    totalRows,
    totalEmbeddings,
    rowsMissingEmbeddings: totalRows - totalEmbeddings,
    invalidDimensionRows: Number(invalidDimensionRowsResult[0]?.count ?? 0),
    duplicateCorpusChunkIds: Number(
      duplicateCorpusChunkIdsResult[0]?.count ?? 0,
    ),
    corpusCounts: corpusCountsResult.map((row) => ({
      corpusId: row.corpus_id,
      rowCount: Number(row.row_count),
      rowsWithEmbeddings: Number(row.rows_with_embeddings),
    })),
  };
}

/** @deprecated Use verifyCorpusImport */
export async function verifyImport(
  prisma: PrismaExecutor,
  expectedDimensions: number = EMBEDDING_DIMENSIONS,
): Promise<{
  totalRows: number;
  invalidDimensionRows: number;
  duplicateChunkIds: number;
}> {
  const verification = await verifyCorpusImport(
    prisma,
    'code-penal',
    expectedDimensions,
  );

  return {
    totalRows: verification.totalRows,
    invalidDimensionRows: verification.invalidDimensionRows,
    duplicateChunkIds: verification.duplicateCorpusChunkIds,
  };
}
