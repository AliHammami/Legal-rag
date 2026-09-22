import type { SimilarChunk } from './types.js';

/** Vector branch depth for hybrid-union (benchmark-validated). */
export const HYBRID_UNION_VECTOR_TOP_K = 50;
/** BM25 branch depth for hybrid-union (benchmark-validated). */
export const HYBRID_UNION_BM25_TOP_K = 50;

export function dedupeUnionSimilarChunks(
  vectorTop: SimilarChunk[],
  bm25Top: SimilarChunk[],
): SimilarChunk[] {
  const seen = new Set<string>();
  const merged: SimilarChunk[] = [];

  for (const chunk of [...vectorTop, ...bm25Top]) {
    if (seen.has(chunk.chunkId)) {
      continue;
    }
    seen.add(chunk.chunkId);
    merged.push(chunk);
  }

  return merged;
}
