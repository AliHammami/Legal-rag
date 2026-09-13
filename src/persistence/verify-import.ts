import { EMBEDDING_DIMENSIONS } from '../embeddings/constants.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { ImportVerification } from './types.js';
import { PENAL_CODE_CHUNKS_TABLE } from './constants.js';

interface CountRow {
  count: number | bigint;
}

export async function verifyImport(
  prisma: PrismaService,
  expectedDimensions: number = EMBEDDING_DIMENSIONS,
): Promise<ImportVerification> {
  const [totalRowsResult, invalidDimensionRowsResult, duplicateChunkIdsResult] =
    await Promise.all([
      prisma.$queryRawUnsafe<CountRow[]>(
        `SELECT COUNT(*)::int AS count FROM ${PENAL_CODE_CHUNKS_TABLE}`,
      ),
      prisma.$queryRawUnsafe<CountRow[]>(
        `SELECT COUNT(*)::int AS count
         FROM ${PENAL_CODE_CHUNKS_TABLE}
         WHERE vector_dims(embedding) <> $1`,
        expectedDimensions,
      ),
      prisma.$queryRawUnsafe<CountRow[]>(
        `SELECT (COUNT(*) - COUNT(DISTINCT chunk_id))::int AS count
         FROM ${PENAL_CODE_CHUNKS_TABLE}`,
      ),
    ]);

  return {
    totalRows: Number(totalRowsResult[0]?.count ?? 0),
    invalidDimensionRows: Number(invalidDimensionRowsResult[0]?.count ?? 0),
    duplicateChunkIds: Number(duplicateChunkIdsResult[0]?.count ?? 0),
  };
}
