import { readFile } from 'node:fs/promises';

import type { PrismaService } from '../../prisma/prisma.service.js';
import { searchSimilarChunks } from '../../retrieval/search-similar-chunks.js';
import { searchSimilarChunksWithCorpusQuota } from '../../retrieval/corpus-quota-retrieval.js';
import type { SimilarChunk } from '../../retrieval/types.js';
import {
  buildGlobalRetrievalAtK,
  buildQuotaRetrievalAtK,
  rankRetrievalChunks,
  type RankedRetrievalChunk,
  type RetrievalDepthK,
} from './retrieval-depth-benchmark.js';

export interface QuestionEmbeddingCacheFile {
  metadata: {
    embeddingModel: string;
    dimensions: number;
    source: string;
  };
  embeddings: Record<string, number[]>;
}

export interface LocalReplayRetrievalLists {
  quotaAt50: RankedRetrievalChunk[];
  globalAt50: RankedRetrievalChunk[];
  perCorpusAt25: Map<string, RankedRetrievalChunk[]>;
}

function mapSimilarChunks(chunks: SimilarChunk[]): RankedRetrievalChunk[] {
  return chunks.map((chunk, index) => ({
    corpusId: chunk.corpusId,
    articleNumber: chunk.articleNumber,
    chunkId: chunk.chunkId,
    rank: index + 1,
    distance: chunk.distance,
  }));
}

export async function loadQuestionEmbeddingCache(
  path: string,
): Promise<QuestionEmbeddingCacheFile> {
  const raw = await readFile(path, 'utf-8');
  return JSON.parse(raw) as QuestionEmbeddingCacheFile;
}

export async function replayRetrievalListsAt50(input: {
  prisma: PrismaService;
  questionId: string;
  embedding: number[];
  routedCorpusIds: string[];
}): Promise<LocalReplayRetrievalLists> {
  const { prisma, embedding, routedCorpusIds } = input;
  const maxK = 50 as RetrievalDepthK;

  if (routedCorpusIds.length <= 1) {
    const corpusId = routedCorpusIds[0]!;
    const single = await searchSimilarChunks(prisma, embedding, maxK, {
      corpusIds: [corpusId],
    });
    const ranked = mapSimilarChunks(single);
    return {
      quotaAt50: ranked,
      globalAt50: ranked,
      perCorpusAt25: new Map([[corpusId, ranked.slice(0, 25)]]),
    };
  }

  const perCorpusAt25 = new Map<string, RankedRetrievalChunk[]>();
  for (const corpusId of routedCorpusIds) {
    const corpusChunks = await searchSimilarChunks(prisma, embedding, 25, {
      corpusIds: [corpusId],
    });
    perCorpusAt25.set(corpusId, mapSimilarChunks(corpusChunks));
  }

  const quotaMerged = buildQuotaRetrievalAtK(
    perCorpusAt25,
    routedCorpusIds,
    maxK,
  );

  const globalChunks = await searchSimilarChunks(prisma, embedding, maxK, {
    corpusIds: routedCorpusIds,
  });

  return {
    quotaAt50: quotaMerged,
    globalAt50: buildGlobalRetrievalAtK(mapSimilarChunks(globalChunks), maxK),
    perCorpusAt25,
  };
}

export function quotaRetrievalFromAuditTop20(
  retrieval: Array<{
    chunkId: string;
    corpusId: string;
    articleNumber: string;
    retrievalDistance: number;
    retrievalRank: number;
  }>,
): RankedRetrievalChunk[] {
  return rankRetrievalChunks(retrieval);
}
