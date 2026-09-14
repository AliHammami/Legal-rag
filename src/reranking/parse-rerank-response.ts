import type { SimilarChunk } from '../retrieval/types.js';
import { RerankingError } from './reranking.error.js';
import type { RerankModelResponse, RerankedChunk } from './types.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function parseRerankModelResponse(value: unknown): RerankModelResponse {
  if (!isRecord(value) || !Array.isArray(value.rankedChunks)) {
    throw new RerankingError(
      'Invalid reranking response: rankedChunks missing',
      'RESPONSE_INVALID',
    );
  }

  if (value.rankedChunks.length === 0) {
    throw new RerankingError(
      'Invalid reranking response: rankedChunks is empty',
      'RESPONSE_INVALID',
    );
  }

  const rankedChunks = value.rankedChunks.map((item, index) => {
    if (!isRecord(item) || typeof item.chunkId !== 'string') {
      throw new RerankingError(
        `Invalid reranking item at index ${index}: chunkId missing`,
        'RESPONSE_INVALID',
      );
    }

    return {
      chunkId: item.chunkId,
    };
  });

  return { rankedChunks };
}

export function applyRerankOrdering(
  chunks: SimilarChunk[],
  response: RerankModelResponse,
  topK: number,
): RerankedChunk[] {
  const chunkById = new Map(chunks.map((chunk) => [chunk.chunkId, chunk]));
  const inputIds = new Set(chunkById.keys());
  const seenIds = new Set<string>();

  if (response.rankedChunks.length !== chunks.length) {
    throw new RerankingError(
      `Incomplete reranking response: expected ${chunks.length} items, got ${response.rankedChunks.length}`,
      'RESPONSE_INCOMPLETE',
    );
  }

  const reranked: RerankedChunk[] = [];

  for (const item of response.rankedChunks) {
    if (!inputIds.has(item.chunkId)) {
      throw new RerankingError(
        `Unknown chunkId in reranking response: ${item.chunkId}`,
        'CHUNK_UNKNOWN',
      );
    }

    if (seenIds.has(item.chunkId)) {
      throw new RerankingError(
        `Duplicate chunkId in reranking response: ${item.chunkId}`,
        'CHUNK_DUPLICATE',
      );
    }

    seenIds.add(item.chunkId);

    const chunk = chunkById.get(item.chunkId)!;
    reranked.push({ ...chunk });
  }

  for (const chunkId of inputIds) {
    if (!seenIds.has(chunkId)) {
      throw new RerankingError(
        `Missing chunkId in reranking response: ${chunkId}`,
        'CHUNK_MISSING',
      );
    }
  }

  return reranked.slice(0, topK);
}
