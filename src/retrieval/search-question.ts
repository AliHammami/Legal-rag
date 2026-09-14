import { performance } from 'node:perf_hooks';

import type { OpenAIService } from '../openai/openai.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { RetrievalError } from './retrieval.error.js';
import { searchSimilarChunks } from './search-similar-chunks.js';
import type { SearchQuestionOptions, SimilarChunk } from './types.js';
import { validateQuestion } from './validate-search-input.js';

export async function searchQuestion(
  prisma: PrismaService,
  openAIService: OpenAIService,
  question: string,
  topK: number,
  options: SearchQuestionOptions = {},
): Promise<SimilarChunk[]> {
  const normalizedQuestion = validateQuestion(question);
  const { profiling, ...searchOptions } = options;

  const embeddingStart = performance.now();
  const embeddingResults = await openAIService.createEmbeddings([
    normalizedQuestion,
  ]);
  if (profiling) {
    profiling.embeddingMs = performance.now() - embeddingStart;
    profiling.embeddingCalls += 1;
  }

  const queryEmbedding = embeddingResults[0]?.embedding;
  if (!queryEmbedding) {
    throw new RetrievalError(
      'OpenAI returned no embedding for the question',
      'EMBEDDING_MISSING',
    );
  }

  const searchStart = performance.now();
  const results = await searchSimilarChunks(
    prisma,
    queryEmbedding,
    topK,
    searchOptions,
  );
  if (profiling) {
    profiling.vectorSearchMs = performance.now() - searchStart;
  }

  return results;
}
