import type { PrismaService } from '../prisma/prisma.service.js';
import { searchSimilarChunks } from './search-similar-chunks.js';
import type { SearchSimilarChunksOptions, SimilarChunk } from './types.js';
import { validateCorpusIds } from './validate-corpus-ids.js';

export function computePerCorpusQuota(
  globalTopK: number,
  corpusCount: number,
): number {
  if (corpusCount <= 0) {
    throw new Error('corpusCount must be positive');
  }

  return Math.ceil(globalTopK / corpusCount);
}

export function dedupeSimilarChunks(chunks: SimilarChunk[]): SimilarChunk[] {
  const seen = new Set<string>();
  const deduped: SimilarChunk[] = [];

  for (const chunk of chunks) {
    if (seen.has(chunk.chunkId)) {
      continue;
    }
    seen.add(chunk.chunkId);
    deduped.push(chunk);
  }

  return deduped;
}

export function sortSimilarChunksByDistance(
  chunks: SimilarChunk[],
): SimilarChunk[] {
  return [...chunks].sort((left, right) => left.distance - right.distance);
}

export function mergeCorpusQuotaCandidates(
  chunks: SimilarChunk[],
  globalTopK: number,
): SimilarChunk[] {
  return sortSimilarChunksByDistance(dedupeSimilarChunks(chunks)).slice(
    0,
    globalTopK,
  );
}

/**
 * Multi-corpus retrieval: one vector search per routed corpus with an equal quota,
 * then merge/deduplicate and cap globally to `globalTopK` by ascending distance.
 *
 * For n=3 with topK=20: quota=7 ? up to 21 merged candidates ? capped to 20 best distances.
 */
export async function searchSimilarChunksWithCorpusQuota(
  prisma: PrismaService,
  queryEmbedding: number[],
  globalTopK: number,
  corpusIds: string[],
  options: SearchSimilarChunksOptions = {},
): Promise<SimilarChunk[]> {
  const normalizedCorpusIds = validateCorpusIds(corpusIds);
  if (!normalizedCorpusIds || normalizedCorpusIds.length <= 1) {
    throw new Error(
      'searchSimilarChunksWithCorpusQuota requires at least two corpusIds',
    );
  }

  const perCorpusTopK = computePerCorpusQuota(
    globalTopK,
    normalizedCorpusIds.length,
  );
  const { corpusIds: _ignored, ...searchOptions } = options;
  const merged: SimilarChunk[] = [];

  for (const corpusId of normalizedCorpusIds) {
    const corpusChunks = await searchSimilarChunks(
      prisma,
      queryEmbedding,
      perCorpusTopK,
      {
        ...searchOptions,
        corpusIds: [corpusId],
      },
    );
    merged.push(...corpusChunks);
  }

  return mergeCorpusQuotaCandidates(merged, globalTopK);
}

export function shouldUseCorpusQuotaRetrieval(corpusIds?: string[]): boolean {
  return corpusIds !== undefined && corpusIds.length > 1;
}
