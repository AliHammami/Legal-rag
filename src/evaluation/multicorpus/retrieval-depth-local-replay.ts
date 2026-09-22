import { readFile } from 'node:fs/promises';

import type { PrismaService } from '../../prisma/prisma.service.js';
import { computePerCorpusQuota } from '../../retrieval/corpus-quota-retrieval.js';
import { searchSimilarChunks } from '../../retrieval/search-similar-chunks.js';
import type { SimilarChunk } from '../../retrieval/types.js';
import {
  buildGlobalRetrievalAtK,
  buildQuotaRetrievalAtK,
  rankRetrievalChunks,
  RETRIEVAL_DEPTH_K_VALUES,
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

const MAX_DEPTH_K = 50 as RetrievalDepthK;

export interface ReplayRetrievalDepthResult {
  perCorpusDeep: Map<string, RankedRetrievalChunk[]>;
  globalDeep: RankedRetrievalChunk[];
  quotaByK: Record<RetrievalDepthK, RankedRetrievalChunk[]>;
  globalByK: Record<RetrievalDepthK, RankedRetrievalChunk[]>;
}

export async function replayRetrievalDepthForQuestion(input: {
  prisma: PrismaService;
  embedding: number[];
  routedCorpusIds: string[];
}): Promise<ReplayRetrievalDepthResult> {
  const { prisma, embedding, routedCorpusIds } = input;
  const perCorpusDeep = new Map<string, RankedRetrievalChunk[]>();

  if (routedCorpusIds.length <= 1) {
    const corpusId = routedCorpusIds[0]!;
    const single = await searchSimilarChunks(prisma, embedding, MAX_DEPTH_K, {
      corpusIds: [corpusId],
    });
    const ranked = mapSimilarChunks(single);
    perCorpusDeep.set(corpusId, ranked);
  } else {
    const perCorpusFetch = computePerCorpusQuota(
      MAX_DEPTH_K,
      routedCorpusIds.length,
    );
    for (const corpusId of routedCorpusIds) {
      const corpusChunks = await searchSimilarChunks(
        prisma,
        embedding,
        perCorpusFetch,
        { corpusIds: [corpusId] },
      );
      perCorpusDeep.set(corpusId, mapSimilarChunks(corpusChunks));
    }
  }

  const globalChunks = await searchSimilarChunks(
    prisma,
    embedding,
    MAX_DEPTH_K,
    {
      corpusIds:
        routedCorpusIds.length > 0 ? routedCorpusIds : undefined,
    },
  );
  const globalDeep = mapSimilarChunks(globalChunks);

  const quotaByK = {} as Record<RetrievalDepthK, RankedRetrievalChunk[]>;
  const globalByK = {} as Record<RetrievalDepthK, RankedRetrievalChunk[]>;
  for (const k of RETRIEVAL_DEPTH_K_VALUES) {
    quotaByK[k] = buildQuotaRetrievalAtK(
      perCorpusDeep,
      routedCorpusIds,
      k,
    );
    globalByK[k] = buildGlobalRetrievalAtK(globalDeep, k);
  }

  return { perCorpusDeep, globalDeep, quotaByK, globalByK };
}

export async function replayRetrievalListsAt50(input: {
  prisma: PrismaService;
  questionId: string;
  embedding: number[];
  routedCorpusIds: string[];
}): Promise<LocalReplayRetrievalLists> {
  const replay = await replayRetrievalDepthForQuestion({
    prisma: input.prisma,
    embedding: input.embedding,
    routedCorpusIds: input.routedCorpusIds,
  });

  const perCorpusAt25 = new Map<string, RankedRetrievalChunk[]>();
  for (const [corpusId, chunks] of replay.perCorpusDeep.entries()) {
    perCorpusAt25.set(corpusId, chunks.slice(0, 25));
  }

  return {
    quotaAt50: replay.quotaByK[50],
    globalAt50: replay.globalByK[50],
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
