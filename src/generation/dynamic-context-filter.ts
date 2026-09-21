import type { RerankedChunk } from '../reranking/types.js';
import {
  DEFAULT_RELATIVE_SCORE_THRESHOLD,
  MAX_CONTEXT_CHUNKS,
  MIN_CONTEXT_CHUNKS,
} from './constants.js';

export interface DynamicContextFilterOptions {
  relativeScoreThreshold?: number;
  /** When length > 1, keeps at least one chunk per routed corpus after threshold filtering. */
  routedCorpusIds?: string[];
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

function ensureMinOneChunkPerRoutedCorpus(
  filtered: RerankedChunk[],
  rerankedChunks: RerankedChunk[],
  routedCorpusIds: string[],
): RerankedChunk[] {
  const cappedInput = rerankedChunks.slice(0, MAX_CONTEXT_CHUNKS);
  const rankIndex = new Map(
    cappedInput.map((chunk, index) => [chunk.chunkId, index]),
  );
  const resultById = new Map(filtered.map((chunk) => [chunk.chunkId, chunk]));

  for (const corpusId of routedCorpusIds) {
    const corpusChunks = cappedInput.filter(
      (chunk) => chunk.corpusId === corpusId,
    );
    if (corpusChunks.length === 0) {
      continue;
    }

    const hasCorpus = [...resultById.values()].some(
      (chunk) => chunk.corpusId === corpusId,
    );
    if (hasCorpus) {
      continue;
    }

    const best = [...corpusChunks].sort(
      (left, right) => (right.rerankScore ?? 0) - (left.rerankScore ?? 0),
    )[0]!;
    resultById.set(best.chunkId, best);
  }

  return [...resultById.values()]
    .sort(
      (left, right) =>
        (rankIndex.get(left.chunkId) ?? 99) - (rankIndex.get(right.chunkId) ?? 99),
    )
    .slice(0, MAX_CONTEXT_CHUNKS);
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
  let filtered: RerankedChunk[];

  if (bestScore <= 0) {
    filtered = cappedInput.slice(0, MIN_CONTEXT_CHUNKS);
  } else {
    const thresholdFiltered = cappedInput.filter((chunk, index) => {
      if (index === 0) {
        return true;
      }

      const relativeScore = computeRelativeScore(getChunkScore(chunk), bestScore);
      return relativeScore >= threshold;
    });

    filtered =
      thresholdFiltered.length < MIN_CONTEXT_CHUNKS
        ? cappedInput.slice(0, MIN_CONTEXT_CHUNKS)
        : thresholdFiltered.slice(0, MAX_CONTEXT_CHUNKS);
  }

  const routedCorpusIds = options.routedCorpusIds;
  if (routedCorpusIds && routedCorpusIds.length > 1) {
    filtered = ensureMinOneChunkPerRoutedCorpus(
      filtered,
      cappedInput,
      routedCorpusIds,
    );
  }

  return filtered;
}
