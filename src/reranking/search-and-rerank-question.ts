import { performance } from 'node:perf_hooks';

import type { OpenAIService } from '../openai/openai.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { PipelineProfilingTimings } from '../profiling/pipeline-timings.js';
import type { SearchSimilarChunksOptions } from '../retrieval/types.js';
import { searchQuestion } from '../retrieval/search-question.js';
import {
  DEFAULT_RERANK_TOP_K,
  DEFAULT_RETRIEVAL_TOP_K,
} from './constants.js';
import { rerankChunks } from './rerank-chunks.js';
import type { RerankerService } from './reranker.service.js';
import { isFallbackEligibleRerankingError } from './reranking.error.js';
import type { RerankStatus, RerankedChunk } from './types.js';

export interface SearchAndRerankQuestionOptions extends SearchSimilarChunksOptions {
  retrievalTopK?: number;
  rerankTopK?: number;
  profiling?: PipelineProfilingTimings;
}

export interface SearchAndRerankQuestionResult {
  candidates: Awaited<ReturnType<typeof searchQuestion>>;
  reranked: RerankedChunk[];
  rerankStatus: RerankStatus;
}

export async function searchAndRerankQuestion(
  prisma: PrismaService,
  openAIService: OpenAIService,
  rerankerService: RerankerService,
  question: string,
  options: SearchAndRerankQuestionOptions = {},
): Promise<SearchAndRerankQuestionResult> {
  const {
    retrievalTopK = DEFAULT_RETRIEVAL_TOP_K,
    rerankTopK = DEFAULT_RERANK_TOP_K,
    profiling,
    ...searchOptions
  } = options;
  const totalStart = profiling ? performance.now() : 0;

  const candidates = await searchQuestion(
    prisma,
    openAIService,
    question,
    retrievalTopK,
    { profiling, ...searchOptions },
  );

  if (profiling) {
    profiling.retrievedCandidates = candidates.length;
  }

  let reranked: RerankedChunk[];
  let rerankStatus: RerankStatus;

  try {
    reranked = await rerankChunks(
      rerankerService,
      question,
      candidates,
      rerankTopK,
      { profiling },
    );
    rerankStatus = 'success';
  } catch (error) {
    if (!isFallbackEligibleRerankingError(error)) {
      throw error;
    }

    console.warn('Jina reranking failed, using vector search fallback.');
    reranked = candidates.slice(0, rerankTopK);
    rerankStatus = 'fallback';
  }

  if (profiling) {
    profiling.rerankStatus = rerankStatus;
    profiling.totalMs = performance.now() - totalStart;
  }

  return { candidates, reranked, rerankStatus };
}
