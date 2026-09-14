import { performance } from 'node:perf_hooks';

import type { SimilarChunk } from '../retrieval/types.js';
import type { PipelineProfilingTimings } from '../profiling/pipeline-timings.js';
import { mapRerankResultsToChunks } from './map-rerank-to-chunks.js';
import type { RerankerService } from './reranker.service.js';
import { toRerankDocuments } from './to-rerank-documents.js';
import type { RerankedChunk } from './types.js';
import { validateRerankingInput } from './validate-reranking-input.js';

export interface RerankChunksOptions {
  profiling?: PipelineProfilingTimings;
}

export async function rerankChunks(
  rerankerService: RerankerService,
  question: string,
  chunks: SimilarChunk[],
  topK: number,
  options: RerankChunksOptions = {},
): Promise<RerankedChunk[]> {
  const normalizedQuestion = validateRerankingInput(question, chunks, topK);
  const documents = toRerankDocuments(chunks);
  const { profiling } = options;

  const jinaStart = performance.now();
  const results = await rerankerService.rerank(normalizedQuestion, documents, {
    topN: topK,
  });
  const jinaRerankingMs = performance.now() - jinaStart;

  const mapStart = performance.now();
  const reranked = mapRerankResultsToChunks(chunks, results);
  const mappingMs = performance.now() - mapStart;

  if (profiling) {
    profiling.jinaRerankingMs = jinaRerankingMs;
    profiling.mappingMs = mappingMs;
    profiling.rerankingCalls = 1;
  }

  return reranked;
}
