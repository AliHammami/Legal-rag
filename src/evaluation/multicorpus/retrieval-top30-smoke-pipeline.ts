import { performance } from 'node:perf_hooks';

import {
  computeRelativeScore,
  dynamicContextFilter,
} from '../../generation/dynamic-context-filter.js';
import { buildRagContext } from '../../generation/build-rag-context.js';
import type { RagGenerationService } from '../../generation/rag-generation.service.js';
import type { OpenAIService } from '../../openai/openai.service.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import { createPipelineProfiling } from '../../profiling/pipeline-timings.js';
import type { RerankerService } from '../../reranking/reranker.service.js';
import { rerankChunks } from '../../reranking/rerank-chunks.js';
import {
  formatRerankingFailureMessage,
  isFallbackEligibleRerankingError,
} from '../../reranking/reranking.error.js';
import type { RerankedChunk } from '../../reranking/types.js';
import { ROUTING_ABSTENTION_ANSWER } from '../../generation/constants.js';
import {
  resolveRoutingForRetrieval,
} from '../../routing/resolve-routing-for-retrieval.js';
import { isRoutingAbstain } from '../../routing/types.js';
import {
  searchSimilarChunksWithCorpusQuota,
  shouldUseCorpusQuotaRetrieval,
} from '../../retrieval/corpus-quota-retrieval.js';
import { searchSimilarChunks } from '../../retrieval/search-similar-chunks.js';
import type { SimilarChunk } from '../../retrieval/types.js';
import {
  goldArticlesMatch,
  type GoldArticle,
} from '../gold-article.js';
import type { E2EJudgeService } from '../e2e-judge.service.js';
import type { E2ESourceJudgeService } from '../e2e-source-judge.service.js';
import type { LegalMulticorpusEvaluationQuestion } from '../multicorpus-dataset.types.js';
import {
  firstRankForGold,
  goldCorpusCoverageAtK,
  goldRecallAtK,
  fullQuestionCoverageAtK,
  rankRetrievalChunks,
  type RankedRetrievalChunk,
} from './retrieval-depth-benchmark.js';

export interface SmokePipelineConfig {
  retrievalTopK: number;
  rerankTopK: number;
  relativeScoreThreshold: number;
  routingModel: string;
}

export interface PersistedRetrievalRow {
  rank: number;
  chunkId: string;
  articleNumber: string;
  corpusId: string;
  distance: number;
}

export interface PersistedRerankRow {
  rank: number;
  chunkId: string;
  articleNumber: string;
  corpusId: string;
  score: number;
}

export interface PersistedFilterRow {
  chunkId: string;
  articleNumber: string;
  corpusId: string;
  rerankScore: number;
  relativeScore: number;
  kept: boolean;
}

export interface RetrievalTop30SmokeQuestionResult {
  questionId: string;
  question: string;
  questionType: LegalMulticorpusEvaluationQuestion['questionType'];
  goldArticles: GoldArticle[];
  config: SmokePipelineConfig;
  routing: {
    decision: string;
    corpusIds: string[];
    abstain?: boolean;
  };
  retrieval: PersistedRetrievalRow[];
  reranking: PersistedRerankRow[];
  filter: {
    threshold: number;
    rows: PersistedFilterRow[];
    finalChunkIds: string[];
  };
  finalContext: {
    chunkIds: string[];
    sources: Array<{ corpusId: string; articleNumber: string }>;
    contextPreview: string;
  };
  generation: {
    answer: string;
    rerankStatus: string;
  };
  judge: {
    correctness: number;
    completeness: number;
    groundedness: number;
    abstentionCorrect: boolean;
    explanation: string;
  };
  sourceJudge: {
    sourceRelevance: number;
    sourceCoverage: number;
    explanation: string;
  };
  metrics: {
    retrievalGoldRecallAt20: number;
    retrievalGoldRecallAt30: number;
    retrievalFullCoverageAt20: boolean;
    retrievalFullCoverageAt30: boolean;
    retrievalCorpusCoverageAt30: number;
    goldNewInRanks21To30: GoldArticle[];
    finalContextGoldHits: GoldArticle[];
    finalContextFullCoverage: boolean;
  };
  profiling: {
    routingMs: number;
    embeddingMs: number;
    vectorSearchMs: number;
    jinaRerankingMs: number;
    contextFilteringMs: number;
    generationMs: number;
    answerPipelineTotalMs: number;
    embeddingCalls: number;
    rerankingCalls: number;
    generationCalls: number;
    routingCalls: number;
  };
  embeddingFromCache: boolean;
}

async function retrieveWithCachedEmbedding(
  prisma: PrismaService,
  embedding: number[],
  topK: number,
  corpusIds: string[] | undefined,
  profiling: ReturnType<typeof createPipelineProfiling>,
): Promise<SimilarChunk[]> {
  const searchStart = performance.now();
  const results = shouldUseCorpusQuotaRetrieval(corpusIds)
    ? await searchSimilarChunksWithCorpusQuota(
        prisma,
        embedding,
        topK,
        corpusIds!,
      )
    : await searchSimilarChunks(prisma, embedding, topK, {
        corpusIds,
      });
  profiling.vectorSearchMs += performance.now() - searchStart;
  return results;
}

function mapRetrievalRows(candidates: SimilarChunk[]): PersistedRetrievalRow[] {
  return candidates.map((chunk, index) => ({
    rank: index + 1,
    chunkId: chunk.chunkId,
    articleNumber: chunk.articleNumber,
    corpusId: chunk.corpusId,
    distance: chunk.distance,
  }));
}

function mapRerankRows(reranked: RerankedChunk[]): PersistedRerankRow[] {
  return reranked.map((chunk, index) => ({
    rank: index + 1,
    chunkId: chunk.chunkId,
    articleNumber: chunk.articleNumber,
    corpusId: chunk.corpusId,
    score: chunk.rerankScore ?? 0,
  }));
}

function buildFilterRows(
  reranked: RerankedChunk[],
  kept: RerankedChunk[],
  threshold: number,
): PersistedFilterRow[] {
  const keptIds = new Set(kept.map((chunk) => chunk.chunkId));
  const bestScore = reranked[0]?.rerankScore ?? 0;
  return reranked.map((chunk) => ({
    chunkId: chunk.chunkId,
    articleNumber: chunk.articleNumber,
    corpusId: chunk.corpusId,
    rerankScore: chunk.rerankScore ?? 0,
    relativeScore: computeRelativeScore(chunk.rerankScore ?? 0, bestScore),
    kept: keptIds.has(chunk.chunkId),
  }));
}

function rankedFromRetrieval(rows: PersistedRetrievalRow[]): RankedRetrievalChunk[] {
  return rankRetrievalChunks(
    rows.map((row) => ({
      chunkId: row.chunkId,
      corpusId: row.corpusId,
      articleNumber: row.articleNumber,
      retrievalDistance: row.distance,
      retrievalRank: row.rank,
    })),
  );
}

export async function runRetrievalTop30SmokeQuestion(input: {
  prisma: PrismaService;
  openAIService: OpenAIService;
  rerankerService: RerankerService;
  generationService: RagGenerationService;
  judgeService: E2EJudgeService;
  sourceJudgeService: E2ESourceJudgeService;
  question: LegalMulticorpusEvaluationQuestion;
  config: SmokePipelineConfig;
  /** When true, calls routing V3.1 (production). Otherwise uses routedCorpusIds replay. */
  liveRouting?: boolean;
  routedCorpusIds?: string[];
  cachedEmbedding?: number[];
}): Promise<RetrievalTop30SmokeQuestionResult> {
  const profiling = createPipelineProfiling();
  const pipelineStart = performance.now();
  const { question, config } = input;

  let routedCorpusIds: string[];
  let routing: {
    decision: string;
    corpusIds: string[];
    abstain?: boolean;
  };

  if (input.liveRouting) {
    const routingStart = performance.now();
    const resolved = await resolveRoutingForRetrieval(
      input.openAIService,
      question.question,
      { model: config.routingModel },
    );
    profiling.routingMs = performance.now() - routingStart;
    profiling.routingCalls = 1;
    routedCorpusIds = resolved.retrievalCorpusIds ?? [];
    routing = {
      decision: resolved.routing.decision,
      corpusIds: resolved.routing.corpusIds,
      abstain: isRoutingAbstain(resolved.routing),
    };
  } else {
    routedCorpusIds = input.routedCorpusIds ?? [];
    routing = {
      decision: routedCorpusIds.length > 0 ? 'routed' : 'abstain',
      corpusIds: routedCorpusIds,
      abstain: routedCorpusIds.length === 0,
    };
  }

  let embedding = input.cachedEmbedding;
  let embeddingFromCache = Boolean(embedding);
  if (!embedding) {
    const embeddingStart = performance.now();
    const embeddingResults = await input.openAIService.createEmbeddings([
      question.question.trim(),
    ]);
    profiling.embeddingMs = performance.now() - embeddingStart;
    profiling.embeddingCalls = 1;
    embedding = embeddingResults[0]?.embedding;
    embeddingFromCache = false;
  }

  if (!embedding) {
    throw new Error(`Missing embedding for ${question.id}`);
  }

  let candidates: SimilarChunk[] = [];
  let reranked: RerankedChunk[] = [];
  let rerankStatus: string;
  let contextChunks: RerankedChunk[] = [];
  let context = '';
  let sources: ReturnType<typeof buildRagContext>['sources'] = [];
  let answer: string;

  if (routing.abstain) {
    rerankStatus = 'success';
    answer = ROUTING_ABSTENTION_ANSWER;
    profiling.answerPipelineTotalMs = performance.now() - pipelineStart;
  } else {
    candidates = await retrieveWithCachedEmbedding(
      input.prisma,
      embedding,
      config.retrievalTopK,
      routedCorpusIds,
      profiling,
    );

    try {
      reranked = await rerankChunks(
        input.rerankerService,
        question.question,
        candidates,
        config.rerankTopK,
        { profiling },
      );
      rerankStatus = 'success';
    } catch (error) {
      if (!isFallbackEligibleRerankingError(error)) {
        throw error;
      }
      reranked = candidates.slice(0, config.rerankTopK).map((chunk) => ({
        ...chunk,
        rerankScore: chunk.distance,
      }));
      rerankStatus = 'fallback';
    }

    const filterCorpusIds =
      routing.corpusIds.length > 1 ? routing.corpusIds : undefined;

    const filterStart = performance.now();
    contextChunks = dynamicContextFilter(reranked, {
      relativeScoreThreshold: config.relativeScoreThreshold,
      routedCorpusIds: filterCorpusIds,
    });
    profiling.contextFilteringMs = performance.now() - filterStart;

    const built = buildRagContext(contextChunks);
    context = built.context;
    sources = built.sources;

    const generationStart = performance.now();
    answer = await input.generationService.generateAnswer({
      question: question.question,
      context,
    });
    profiling.generationMs = performance.now() - generationStart;
    profiling.generationCalls = 1;
    profiling.answerPipelineTotalMs = performance.now() - pipelineStart;
  }

  const expectedAbstention =
    question.questionType === 'ambiguous' ||
    question.questionType === 'out-of-scope' ||
    Boolean(routing.abstain);

  const judge = await input.judgeService.judgeQuestion({
    questionId: question.id,
    question: question.question,
    referenceAnswer: expectedAbstention ? null : question.referenceAnswer,
    generatedAnswer: answer,
    context,
    expectedAbstention,
  });

  const sourceJudge = await input.sourceJudgeService.judgeSources({
    questionId: question.id,
    question: question.question,
    referenceAnswer: expectedAbstention ? null : question.referenceAnswer,
    generatedAnswer: answer,
    expectedAbstention,
    sources: sources.map((source) => ({
      sourceId: source.sourceId,
      chunkId: source.chunkId,
      articleNumber: source.articleNumber,
      content: source.content,
    })),
    judgeResult: judge,
  });

  const retrievalRows = mapRetrievalRows(candidates);
  const rankedAll = rankedFromRetrieval(retrievalRows);
  const goldCorpusIds = [
    ...new Set(question.goldArticles.map((article) => article.corpusId)),
  ].sort();

  const recall20 = goldRecallAtK(question.goldArticles, rankedAll, 20);
  const recall30 = goldRecallAtK(question.goldArticles, rankedAll, 30);
  const corpus30 = goldCorpusCoverageAtK(
    goldCorpusIds,
    question.goldArticles,
    rankedAll,
    30,
  );

  const goldNewInRanks21To30 = question.goldArticles.filter((gold) => {
    const rank20 = firstRankForGold(gold, rankedAll.slice(0, 20));
    const rank30 = firstRankForGold(gold, rankedAll.slice(0, 30));
    return rank20 === null && rank30 !== null;
  });

  const finalSources = sources.map((source) => ({
    corpusId: source.chunk.corpusId ?? 'unknown',
    articleNumber: source.articleNumber,
  }));
  const finalContextGoldHits = question.goldArticles.filter((gold) =>
    finalSources.some((source) => goldArticlesMatch(gold, source)),
  );

  return {
    questionId: question.id,
    question: question.question,
    questionType: question.questionType,
    goldArticles: question.goldArticles,
    config,
    routing,
    retrieval: retrievalRows,
    reranking: mapRerankRows(reranked),
    filter: {
      threshold: config.relativeScoreThreshold,
      rows: buildFilterRows(reranked, contextChunks, config.relativeScoreThreshold),
      finalChunkIds: contextChunks.map((chunk) => chunk.chunkId),
    },
    finalContext: {
      chunkIds: contextChunks.map((chunk) => chunk.chunkId),
      sources: finalSources,
      contextPreview: context.slice(0, 500),
    },
    generation: {
      answer,
      rerankStatus,
    },
    judge: {
      correctness: judge.correctness,
      completeness: judge.completeness,
      groundedness: judge.groundedness,
      abstentionCorrect: judge.abstentionCorrect,
      explanation: judge.explanation,
    },
    sourceJudge: {
      sourceRelevance: sourceJudge.sourceRelevance,
      sourceCoverage: sourceJudge.sourceCoverage,
      explanation: sourceJudge.explanation,
    },
    metrics: {
      retrievalGoldRecallAt20: recall20.recall,
      retrievalGoldRecallAt30: recall30.recall,
      retrievalFullCoverageAt20: fullQuestionCoverageAtK(
        question.goldArticles,
        rankedAll,
        20,
      ),
      retrievalFullCoverageAt30: fullQuestionCoverageAtK(
        question.goldArticles,
        rankedAll,
        30,
      ),
      retrievalCorpusCoverageAt30: corpus30.total
        ? corpus30.covered / corpus30.total
        : 0,
      goldNewInRanks21To30,
      finalContextGoldHits,
      finalContextFullCoverage:
        finalContextGoldHits.length === question.goldArticles.length,
    },
    profiling: {
      routingMs: profiling.routingMs,
      embeddingMs: profiling.embeddingMs,
      vectorSearchMs: profiling.vectorSearchMs,
      jinaRerankingMs: profiling.jinaRerankingMs,
      contextFilteringMs: profiling.contextFilteringMs,
      generationMs: profiling.generationMs,
      answerPipelineTotalMs: profiling.answerPipelineTotalMs,
      embeddingCalls: profiling.embeddingCalls,
      rerankingCalls: profiling.rerankingCalls,
      generationCalls: profiling.generationCalls,
      routingCalls: profiling.routingCalls,
    },
    embeddingFromCache,
  };
}
