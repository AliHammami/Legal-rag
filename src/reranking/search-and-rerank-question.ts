import { performance } from 'node:perf_hooks';

import type { OpenAIService } from '../openai/openai.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { PipelineProfilingTimings } from '../profiling/pipeline-timings.js';
import {
  resolveRoutingForRetrieval,
  resolveRoutingFromRouterResult,
  routingMetadataFromExplicitCorpusIds,
} from '../routing/resolve-routing-for-retrieval.js';
import type { RoutingMetadata, RoutingResult } from '../routing/types.js';
import type { SearchSimilarChunksOptions } from '../retrieval/types.js';
import { searchQuestion } from '../retrieval/search-question.js';
import {
  DEFAULT_RERANK_TOP_K,
  DEFAULT_RETRIEVAL_TOP_K,
} from './constants.js';
import { rerankChunks } from './rerank-chunks.js';
import type { RerankerService } from './reranker.service.js';
import {
  formatRerankingFailureMessage,
  isFallbackEligibleRerankingError,
} from './reranking.error.js';
import type { RerankStatus, RerankedChunk } from './types.js';

export interface SearchAndRerankQuestionOptions extends SearchSimilarChunksOptions {
  retrievalTopK?: number;
  rerankTopK?: number;
  profiling?: PipelineProfilingTimings;
  /** When false, skips LLM routing and uses explicit corpusIds or global retrieval. */
  enableRouting?: boolean;
  /** Replays a prior router decision without calling the routing LLM. */
  routingResultOverride?: Pick<RoutingResult, 'corpusIds'>;
}

export interface SearchAndRerankQuestionResult {
  candidates: Awaited<ReturnType<typeof searchQuestion>>;
  reranked: RerankedChunk[];
  rerankStatus: RerankStatus;
  routing?: RoutingMetadata;
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
    enableRouting = true,
    corpusIds: explicitCorpusIds,
    routingResultOverride,
    ...searchOptions
  } = options;
  const totalStart = profiling ? performance.now() : 0;

  let routing: RoutingMetadata | undefined;
  let retrievalCorpusIds: string[] | undefined;

  if (explicitCorpusIds !== undefined) {
    routing = routingMetadataFromExplicitCorpusIds(explicitCorpusIds);
    retrievalCorpusIds =
      explicitCorpusIds.length > 0 ? explicitCorpusIds : undefined;
  } else if (enableRouting) {
    let resolved;

    if (routingResultOverride !== undefined) {
      resolved = resolveRoutingFromRouterResult(routingResultOverride);
    } else {
      const routingStart = performance.now();
      resolved = await resolveRoutingForRetrieval(openAIService, question);
      if (profiling) {
        profiling.routingMs = performance.now() - routingStart;
        profiling.routingCalls = 1;
      }
    }

    routing = resolved.routing;

    if (resolved.abstain) {
      if (profiling) {
        profiling.retrievedCandidates = 0;
        profiling.rerankStatus = 'success';
        profiling.totalMs = performance.now() - totalStart;
      }

      return {
        candidates: [],
        reranked: [],
        rerankStatus: 'success',
        routing,
      };
    }

    retrievalCorpusIds = resolved.retrievalCorpusIds;
  }

  const candidates = await searchQuestion(
    prisma,
    openAIService,
    question,
    retrievalTopK,
    {
      profiling,
      ...searchOptions,
      corpusIds: retrievalCorpusIds,
    },
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

    console.warn(
      `Jina reranking failed: ${formatRerankingFailureMessage(error)}; using vector search fallback.`,
    );
    reranked = candidates.slice(0, rerankTopK);
    rerankStatus = 'fallback';
  }

  if (profiling) {
    profiling.rerankStatus = rerankStatus;
    profiling.totalMs = performance.now() - totalStart;
  }

  return { candidates, reranked, rerankStatus, routing };
}
