import type { RerankedChunk } from '../reranking/types.js';
import { DEFAULT_CONTEXT_TOP_K } from './constants.js';

export function validateContextTopK(contextTopK: number): number {
  if (!Number.isInteger(contextTopK) || contextTopK <= 0) {
    throw new Error(
      `contextTopK must be a positive integer, received: ${contextTopK}`,
    );
  }

  return contextTopK;
}

export function resolveContextTopK(contextTopK?: number): number {
  if (contextTopK === undefined) {
    return DEFAULT_CONTEXT_TOP_K;
  }

  return validateContextTopK(contextTopK);
}

export function selectContextChunks(
  reranked: RerankedChunk[],
  contextTopK: number,
): RerankedChunk[] {
  const normalizedContextTopK = validateContextTopK(contextTopK);
  return reranked.slice(0, normalizedContextTopK);
}
