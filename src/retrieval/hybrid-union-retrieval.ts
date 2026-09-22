import { performance } from 'node:perf_hooks';

import type { OpenAIService } from '../openai/openai.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { PipelineProfilingTimings } from '../profiling/pipeline-timings.js';
import { retrieveBm25SimilarChunks } from './bm25/corpus-bm25-cache.js';
import {
  dedupeUnionSimilarChunks,
  HYBRID_UNION_BM25_TOP_K,
  HYBRID_UNION_VECTOR_TOP_K,
} from './hybrid-union.js';
import {
  searchSimilarChunksWithCorpusQuota,
  shouldUseCorpusQuotaRetrieval,
} from './corpus-quota-retrieval.js';
import { searchSimilarChunks } from './search-similar-chunks.js';
import type { SearchQuestionOptions, SimilarChunk } from './types.js';
import { validateQuestion } from './validate-search-input.js';
import { RetrievalError } from './retrieval.error.js';

export async function retrieveHybridUnionWithEmbedding(
  prisma: PrismaService,
  queryEmbedding: number[],
  question: string,
  options: SearchQuestionOptions & {
    vectorTopK?: number;
    bm25TopK?: number;
    profiling?: PipelineProfilingTimings;
  } = {},
): Promise<SimilarChunk[]> {
  const normalizedQuestion = validateQuestion(question);
  const vectorTopK = options.vectorTopK ?? HYBRID_UNION_VECTOR_TOP_K;
  const bm25TopK = options.bm25TopK ?? HYBRID_UNION_BM25_TOP_K;
  const corpusIds = options.corpusIds;
  const { profiling, ...searchOptions } = options;

  const searchStart = performance.now();
  const vectorChunks = shouldUseCorpusQuotaRetrieval(corpusIds)
    ? await searchSimilarChunksWithCorpusQuota(
        prisma,
        queryEmbedding,
        vectorTopK,
        corpusIds!,
        searchOptions,
      )
    : await searchSimilarChunks(
        prisma,
        queryEmbedding,
        vectorTopK,
        searchOptions,
      );
  if (profiling) {
    profiling.vectorSearchMs = performance.now() - searchStart;
  }

  const bm25Chunks =
    corpusIds && corpusIds.length > 0
      ? await retrieveBm25SimilarChunks({
          prisma,
          question: normalizedQuestion,
          routedCorpusIds: corpusIds,
          topK: bm25TopK,
        })
      : [];

  return dedupeUnionSimilarChunks(vectorChunks, bm25Chunks);
}

export async function retrieveHybridUnionCandidates(
  prisma: PrismaService,
  openAIService: OpenAIService,
  question: string,
  options: SearchQuestionOptions & {
    vectorTopK?: number;
    bm25TopK?: number;
    profiling?: PipelineProfilingTimings;
  } = {},
): Promise<SimilarChunk[]> {
  const normalizedQuestion = validateQuestion(question);
  const vectorTopK = options.vectorTopK ?? HYBRID_UNION_VECTOR_TOP_K;
  const bm25TopK = options.bm25TopK ?? HYBRID_UNION_BM25_TOP_K;
  const corpusIds = options.corpusIds;
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
  const vectorChunks = shouldUseCorpusQuotaRetrieval(corpusIds)
    ? await searchSimilarChunksWithCorpusQuota(
        prisma,
        queryEmbedding,
        vectorTopK,
        corpusIds!,
        searchOptions,
      )
    : await searchSimilarChunks(
        prisma,
        queryEmbedding,
        vectorTopK,
        searchOptions,
      );
  if (profiling) {
    profiling.vectorSearchMs = performance.now() - searchStart;
  }

  const bm25Chunks =
    corpusIds && corpusIds.length > 0
      ? await retrieveBm25SimilarChunks({
          prisma,
          question: normalizedQuestion,
          routedCorpusIds: corpusIds,
          topK: bm25TopK,
        })
      : [];

  return dedupeUnionSimilarChunks(vectorChunks, bm25Chunks);
}
