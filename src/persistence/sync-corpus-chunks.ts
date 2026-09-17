import { LEGAL_CODE_CHUNKS_TABLE } from './constants.js';
import type { PrismaExecutor } from './prisma-executor.js';

export interface ObsoleteChunkDeletionResult {
  deletedCount: number;
  deletedChunkIds: string[];
}

export function findObsoleteChunkIds(
  existingChunkIds: readonly string[],
  expectedChunkIds: readonly string[],
): string[] {
  const expected = new Set(expectedChunkIds);
  return existingChunkIds.filter((chunkId) => !expected.has(chunkId)).sort();
}

interface DeletedChunkRow {
  chunk_id: string;
}

/**
 * Supprime en une requete les chunks du corpus absents du fichier source.
 * Utilise NOT (chunk_id = ANY($expected)) pour eviter un DELETE par chunk.
 */
export async function deleteObsoleteCorpusChunks(
  prisma: PrismaExecutor,
  corpusId: string,
  expectedChunkIds: readonly string[],
): Promise<ObsoleteChunkDeletionResult> {
  if (expectedChunkIds.length === 0) {
    return { deletedCount: 0, deletedChunkIds: [] };
  }

  const rows = await prisma.$queryRawUnsafe<DeletedChunkRow[]>(
    `DELETE FROM ${LEGAL_CODE_CHUNKS_TABLE}
     WHERE corpus_id = $1
       AND NOT (chunk_id = ANY($2::text[]))
     RETURNING chunk_id`,
    corpusId,
    expectedChunkIds,
  );

  const deletedChunkIds = rows.map((row) => row.chunk_id).sort();
  return {
    deletedCount: deletedChunkIds.length,
    deletedChunkIds,
  };
}

export async function listCorpusChunkIds(
  prisma: PrismaExecutor,
  corpusId: string,
): Promise<string[]> {
  const rows = await prisma.$queryRawUnsafe<Array<{ chunk_id: string }>>(
    `SELECT chunk_id
     FROM ${LEGAL_CODE_CHUNKS_TABLE}
     WHERE corpus_id = $1
     ORDER BY chunk_id`,
    corpusId,
  );

  return rows.map((row) => row.chunk_id);
}
