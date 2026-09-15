import { performance } from 'node:perf_hooks';

import type { OpenAIService } from '../openai/openai.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { PipelineProfilingTimings } from '../profiling/pipeline-timings.js';
import { createPipelineProfiling } from '../profiling/pipeline-timings.js';
import type { RerankerService } from '../reranking/reranker.service.js';
import { searchAndRerankQuestion } from '../reranking/search-and-rerank-question.js';
import {
  DEFAULT_RERANK_TOP_K,
  DEFAULT_RETRIEVAL_TOP_K,
} from '../reranking/constants.js';
import { buildRagContext } from './build-rag-context.js';
import type { RagGenerationService } from './rag-generation.service.js';
import { resolveContextTopK, selectContextChunks } from './select-context-chunks.js';
import type { AnswerQuestionResult } from './types.js';

export interface AnswerQuestionOptions {
  retrievalTopK?: number;
  rerankTopK?: number;
  contextTopK?: number;
  profiling?: PipelineProfilingTimings;
}

export async function answerQuestion(
  prisma: PrismaService,
  openAIService: OpenAIService,
  rerankerService: RerankerService,
  generationService: RagGenerationService,
  question: string,
  options: AnswerQuestionOptions = {},
): Promise<AnswerQuestionResult> {
  const retrievalTopK = options.retrievalTopK ?? DEFAULT_RETRIEVAL_TOP_K;
  const rerankTopK = options.rerankTopK ?? DEFAULT_RERANK_TOP_K;
  const contextTopK = resolveContextTopK(options.contextTopK);
  const profiling = options.profiling ?? createPipelineProfiling();
  const pipelineStart = performance.now();

  const { candidates, reranked, rerankStatus } = await searchAndRerankQuestion(
    prisma,
    openAIService,
    rerankerService,
    question,
    { retrievalTopK, rerankTopK, profiling },
  );

  const contextChunks = selectContextChunks(reranked, contextTopK);

  const contextStart = performance.now();
  const { context, sources } = buildRagContext(contextChunks);
  profiling.contextBuilderMs = performance.now() - contextStart;

  const generationStart = performance.now();
  const answer = await generationService.generateAnswer({
    question,
    context,
  });
  profiling.generationMs = performance.now() - generationStart;
  profiling.generationCalls = 1;
  profiling.answerPipelineTotalMs = performance.now() - pipelineStart;

  return {
    question,
    candidates,
    reranked,
    rerankStatus,
    contextTopK,
    context,
    sources,
    answer,
    profiling,
  };
}
