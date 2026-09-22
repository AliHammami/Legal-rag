import type { RankedRetrievalChunk } from './retrieval-depth-benchmark.js';

/** Standard RRF constant (Cormack et al.); configurable for benchmarks. */
export const DEFAULT_HYBRID_RRF_K = 60;

export interface RrfConfig {
  k: number;
}

export function dedupeUnionCandidates(
  vectorTop: RankedRetrievalChunk[],
  bm25Top: RankedRetrievalChunk[],
): RankedRetrievalChunk[] {
  const seen = new Set<string>();
  const merged: RankedRetrievalChunk[] = [];

  for (const chunk of [...vectorTop, ...bm25Top]) {
    if (seen.has(chunk.chunkId)) {
      continue;
    }
    seen.add(chunk.chunkId);
    merged.push({
      ...chunk,
      rank: merged.length + 1,
    });
  }

  return merged;
}

export function reciprocalRankFusion(
  lists: Array<{ name: string; ranked: RankedRetrievalChunk[] }>,
  config: RrfConfig = { k: DEFAULT_HYBRID_RRF_K },
): Array<RankedRetrievalChunk & { rrfScore: number }> {
  const scores = new Map<
    string,
    {
      score: number;
      chunk: RankedRetrievalChunk;
    }
  >();

  for (const list of lists) {
    for (const chunk of list.ranked) {
      const contribution = 1 / (config.k + chunk.rank);
      const existing = scores.get(chunk.chunkId);
      if (existing) {
        existing.score += contribution;
      } else {
        scores.set(chunk.chunkId, {
          score: contribution,
          chunk,
        });
      }
    }
  }

  return [...scores.values()]
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return left.chunk.chunkId.localeCompare(right.chunk.chunkId);
    })
    .map((entry, index) => ({
      ...entry.chunk,
      rank: index + 1,
      rrfScore: entry.score,
    }));
}

export function truncateRankedAtK(
  chunks: RankedRetrievalChunk[],
  k: number,
): RankedRetrievalChunk[] {
  return chunks.slice(0, k).map((chunk, index) => ({
    ...chunk,
    rank: index + 1,
  }));
}
