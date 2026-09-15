import type { RerankedChunk } from '../reranking/types.js';
import {
  DEFAULT_RELATIVE_SCORE_THRESHOLD,
  MAX_CONTEXT_CHUNKS,
  MIN_CONTEXT_CHUNKS,
} from './constants.js';

export interface DynamicContextFilterOptions {
  relativeScoreThreshold?: number;
}

function getChunkScore(chunk: RerankedChunk): number {
  return chunk.rerankScore ?? 0;
}

export function computeRelativeScore(
  score: number,
  bestScore: number,
): number {
  if (bestScore <= 0) {
    return score === bestScore ? 1 : 0;
  }

  return score / bestScore;
}

export function dynamicContextFilter(
  rerankedChunks: RerankedChunk[],
  options: DynamicContextFilterOptions = {},
): RerankedChunk[] {
  if (rerankedChunks.length === 0) {
    return [];
  }

  const threshold =
    options.relativeScoreThreshold ?? DEFAULT_RELATIVE_SCORE_THRESHOLD;
  const cappedInput = rerankedChunks.slice(0, MAX_CONTEXT_CHUNKS);
  const bestScore = getChunkScore(cappedInput[0]!);

  if (bestScore <= 0) {
    return cappedInput.slice(0, MIN_CONTEXT_CHUNKS);
  }

  const filtered = cappedInput.filter((chunk, index) => {
    if (index === 0) {
      return true;
    }

    const relativeScore = computeRelativeScore(getChunkScore(chunk), bestScore);
    return relativeScore >= threshold;
  });

  if (filtered.length < MIN_CONTEXT_CHUNKS) {
    return cappedInput.slice(0, MIN_CONTEXT_CHUNKS);
  }

  return filtered.slice(0, MAX_CONTEXT_CHUNKS);
}
