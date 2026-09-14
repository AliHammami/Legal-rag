import type { SimilarChunk } from '../retrieval/types.js';
import type { RerankResult, RerankedChunk } from './types.js';

export function mapRerankResultsToChunks(
  chunks: SimilarChunk[],
  results: RerankResult[],
): RerankedChunk[] {
  const chunkById = new Map(chunks.map((chunk) => [chunk.chunkId, chunk]));

  return results.map((result) => {
    const chunk = chunkById.get(result.chunkId);
    if (!chunk) {
      throw new Error(`Unknown chunkId after reranking: ${result.chunkId}`);
    }

    return {
      ...chunk,
      rerankScore: result.score,
    };
  });
}
