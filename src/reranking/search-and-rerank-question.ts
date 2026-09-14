import { performance } from 'node:perf_hooks';

import type { OpenAIService } from '../openai/openai.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { PipelineProfilingTimings } from '../profiling/pipeline-timings.js';
import { searchQuestion } from '../retrieval/search-question.js';
import {
  DEFAULT_RERANK_TOP_K,
  DEFAULT_RETRIEVAL_TOP_K,
} from './constants.js';
import { rerankChunks } from './rerank-chunks.js';
import type { RerankedChunk } from './types.js';

export interface SearchAndRerankQuestionOptions {
  retrievalTopK?: number;
  rerankTopK?: number;
  profiling?: PipelineProfilingTimings;
}

export interface SearchAndRerankQuestionResult {
  candidates: Awaited<ReturnType<typeof searchQuestion>>;
  reranked: RerankedChunk[];
}

export async function searchAndRerankQuestion(
  prisma: PrismaService,
  openAIService: OpenAIService,
  question: string,
  options: SearchAndRerankQuestionOptions = {},
): Promise<SearchAndRerankQuestionResult> {
  const retrievalTopK = options.retrievalTopK ?? DEFAULT_RETRIEVAL_TOP_K;
  const rerankTopK = options.rerankTopK ?? DEFAULT_RERANK_TOP_K;
  const { profiling } = options;
  const totalStart = profiling ? performance.now() : 0;

  const candidates = await searchQuestion(
    prisma,
    openAIService,
    question,
    retrievalTopK,
    { profiling },
  );

  const reranked = await rerankChunks(
    openAIService,
    question,
    candidates,
    rerankTopK,
    { profiling },
  );

  if (profiling) {
    profiling.totalMs = performance.now() - totalStart;
  }

  return { candidates, reranked };
}
