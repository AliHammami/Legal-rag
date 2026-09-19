import { average } from '../metrics.js';
import type { LegalMulticorpusEvaluationQuestion } from '../multicorpus-dataset.types.js';
import {
  buildMetricBreakdown,
  groupQuestionsByDifficulty,
  groupQuestionsByGoldCorpus,
  groupQuestionsByType,
} from './breakdown.js';
import { analyzeErrors } from './error-analyzer.js';
import { averageRetrievalMetrics, latencyStats } from './metrics.js';
import type {
  E2EQuestionResult,
  MulticorpusEvaluationReports,
  MulticorpusRunMetadata,
  RerankingQuestionResult,
  RetrievalQuestionResult,
  RoutingQuestionResult,
} from './types.js';

export function aggregateRoutingResults(
  questions: LegalMulticorpusEvaluationQuestion[],
  results: RoutingQuestionResult[],
): MulticorpusEvaluationReports['routing'] {
  const withGold = results.filter(
    (result) =>
      result.questionType === 'single-corpus' ||
      result.questionType === 'multi-corpus',
  );
  const ambiguous = results.filter((result) => result.questionType === 'ambiguous');
  const outOfScope = results.filter((result) => result.questionType === 'out-of-scope');

  return {
    summary: {
      exactMatchRate: average(withGold.map((result) => (result.exactMatch ? 1 : 0))),
      precision: average(withGold.map((result) => result.precision)),
      recall: average(withGold.map((result) => result.recall)),
      f1: average(withGold.map((result) => result.f1)),
      ambiguousEmptyPredictionRate: average(
        ambiguous.map((result) =>
          result.predictedCorpusIds.length === 0 ? 1 : 0,
        ),
      ),
      outOfScopeEmptyPredictionRate: average(
        outOfScope.map((result) =>
          result.predictedCorpusIds.length === 0 ? 1 : 0,
        ),
      ),
      averageLatencyMs: average(results.map((result) => result.latencyMs)),
    },
    breakdown: [
      ...buildMetricBreakdown(questions, results, groupQuestionsByType(questions), (result) => ({
        exactMatch: result.exactMatch ? 1 : 0,
        precision: result.precision,
        recall: result.recall,
        f1: result.f1,
      })),
      ...buildMetricBreakdown(questions, results, groupQuestionsByDifficulty(questions), (result) => ({
        exactMatch: result.exactMatch ? 1 : 0,
        f1: result.f1,
      })),
      ...buildMetricBreakdown(questions, results, groupQuestionsByGoldCorpus(questions), (result) => ({
        exactMatch: result.exactMatch ? 1 : 0,
        f1: result.f1,
      })),
    ],
    results,
  };
}

export function aggregateRetrievalResults(
  questions: LegalMulticorpusEvaluationQuestion[],
  results: RetrievalQuestionResult[],
): MulticorpusEvaluationReports['retrieval'] {
  return {
    summary: {
      global: averageRetrievalMetrics(results.map((result) => result.global)),
      routed: averageRetrievalMetrics(results.map((result) => result.routed)),
    },
    breakdown: [
      ...buildMetricBreakdown(questions, results, groupQuestionsByType(questions), (result) => ({
        globalRecallAt5: result.global.recallAt5,
        routedRecallAt5: result.routed.recallAt5,
        globalMrr: result.global.mrr,
        routedMrr: result.routed.mrr,
      })),
      ...buildMetricBreakdown(questions, results, groupQuestionsByDifficulty(questions), (result) => ({
        globalRecallAt5: result.global.recallAt5,
        routedRecallAt5: result.routed.recallAt5,
      })),
    ],
    results,
  };
}

export function aggregateRerankingResults(
  questions: LegalMulticorpusEvaluationQuestion[],
  results: RerankingQuestionResult[],
): MulticorpusEvaluationReports['reranking'] {
  return {
    summary: {
      vectorTop5: averageRetrievalMetrics(results.map((result) => result.vectorTop5)),
      jinaTop5: averageRetrievalMetrics(results.map((result) => result.jinaTop5)),
      improved: results.filter((result) => result.rerankEffect === 'improved').length,
      degraded: results.filter((result) => result.rerankEffect === 'degraded').length,
      unchanged: results.filter((result) => result.rerankEffect === 'unchanged').length,
    },
    breakdown: buildMetricBreakdown(
      questions,
      results,
      groupQuestionsByType(questions),
      (result) => ({
        vectorRecallAt5: result.vectorTop5.recallAt5,
        jinaRecallAt5: result.jinaTop5.recallAt5,
        vectorMrr: result.vectorTop5.mrr,
        jinaMrr: result.jinaTop5.mrr,
      }),
    ),
    results,
  };
}

export function countE2ERerankFallbacks(results: E2EQuestionResult[]): number {
  return results.reduce((count, result) => {
    let fallbacks = 0;
    if (result.baseline.profiling.rerankStatus === 'fallback') {
      fallbacks += 1;
    }
    if (result.routing.profiling.rerankStatus === 'fallback') {
      fallbacks += 1;
    }
    return count + fallbacks;
  }, 0);
}

export function aggregateE2EResults(
  questions: LegalMulticorpusEvaluationQuestion[],
  results: E2EQuestionResult[],
): MulticorpusEvaluationReports['e2e'] {
  const score = (variant: E2EQuestionResult['baseline']) => ({
    correctness: variant.judge?.correctness ?? 0,
    completeness: variant.judge?.completeness ?? 0,
    groundedness: variant.judge?.groundedness ?? 0,
    abstention: variant.judge?.abstentionCorrect ? 1 : 0,
    sourceRelevance: variant.sourceJudge?.sourceRelevance ?? 0,
    sourceCoverage: variant.sourceJudge?.sourceCoverage ?? 0,
  });

  const baselineScores = results.map((result) => score(result.baseline));
  const routingScores = results.map((result) => score(result.routing));

  const averageScores = (rows: ReturnType<typeof score>[]) => ({
    correctness: average(rows.map((row) => row.correctness)),
    completeness: average(rows.map((row) => row.completeness)),
    groundedness: average(rows.map((row) => row.groundedness)),
    abstention: average(rows.map((row) => row.abstention)),
    sourceRelevance: average(rows.map((row) => row.sourceRelevance)),
    sourceCoverage: average(rows.map((row) => row.sourceCoverage)),
  });

  return {
    summary: {
      baseline: averageScores(baselineScores),
      routing: averageScores(routingScores),
    },
    rerankFallbacks: countE2ERerankFallbacks(results),
    rerankPipelineRuns: results.length * 2,
    latency: {
      baseline: latencyStats(
        results.map((result) => result.baseline.profiling.answerPipelineTotalMs),
      ),
      routing: latencyStats(
        results.map((result) => result.routing.profiling.answerPipelineTotalMs),
      ),
      routingStage: latencyStats(
        results.map((result) => result.routing.profiling.routingMs),
      ),
      embedding: latencyStats(
        results.map((result) => result.routing.profiling.embeddingMs),
      ),
      retrieval: latencyStats(
        results.map((result) => result.routing.profiling.vectorSearchMs),
      ),
      reranking: latencyStats(
        results.map((result) => result.routing.profiling.jinaRerankingMs),
      ),
      generation: latencyStats(
        results.map((result) => result.routing.profiling.generationMs),
      ),
    },
    breakdown: buildMetricBreakdown(
      questions,
      results,
      groupQuestionsByType(questions),
      (result) => ({
        baselineCorrectness: result.baseline.judge?.correctness ?? 0,
        routingCorrectness: result.routing.judge?.correctness ?? 0,
      }),
    ),
    results,
  };
}

export function buildMulticorpusEvaluationReports(input: {
  metadata: MulticorpusRunMetadata;
  questions: LegalMulticorpusEvaluationQuestion[];
  routing?: RoutingQuestionResult[];
  retrieval?: RetrievalQuestionResult[];
  reranking?: RerankingQuestionResult[];
  e2e?: E2EQuestionResult[];
}): MulticorpusEvaluationReports {
  const reports: MulticorpusEvaluationReports = {
    metadata: input.metadata,
  };

  if (input.routing) {
    reports.routing = aggregateRoutingResults(input.questions, input.routing);
  }
  if (input.retrieval) {
    reports.retrieval = aggregateRetrievalResults(input.questions, input.retrieval);
  }
  if (input.reranking) {
    reports.reranking = aggregateRerankingResults(input.questions, input.reranking);
  }
  if (input.e2e) {
    reports.e2e = aggregateE2EResults(input.questions, input.e2e);
  }

  reports.errors = analyzeErrors(input.questions, {
    routing: input.routing,
    retrieval: input.retrieval,
    reranking: input.reranking,
    e2e: input.e2e,
  });

  return reports;
}
