import {
  goldArticlesMatch,
  type GoldArticle,
} from '../gold-article.js';
import type { RetrievalTop30SmokeQuestionResult } from './retrieval-top30-smoke-pipeline.js';

export type Top30SmokeDecision =
  | 'TOPK_30_JUSTIFIED'
  | 'TOPK_30_NOT_USEFUL'
  | 'TOPK_30_MIXED';

export interface BaselineE2ERoutingMetrics {
  questionCount: number;
  correctness: number;
  completeness: number;
  groundedness: number;
  sourceRelevance: number;
  sourceCoverage: number;
  abstentionCorrectRate: number;
  avgLatencyMs: number;
}

export interface SmokeAggregateMetrics {
  retrievalGoldRecallAt20: number;
  retrievalGoldRecallAt30: number;
  finalContextGoldRecall: number;
  finalContextFullCoverageRate: number;
  correctness: number;
  completeness: number;
  groundedness: number;
  sourceRelevance: number;
  sourceCoverage: number;
  abstentionCorrectRate: number;
  avgLatencyMs: number;
  goldNewIn21To30Count: number;
  goldNewIn21To30InFinalContext: number;
  goldNewIn21To30InRerankTop5: number;
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function aggregateSmokeResults(
  results: RetrievalTop30SmokeQuestionResult[],
): SmokeAggregateMetrics {
  const goldTotal = results.reduce(
    (sum, result) => sum + result.goldArticles.length,
    0,
  );
  const goldHitsAt20 = results.reduce(
    (sum, result) =>
      sum +
      result.goldArticles.filter((gold) =>
        result.retrieval.some(
          (row) =>
            row.rank <= 20 && goldArticlesMatch(gold, row),
        ),
      ).length,
    0,
  );
  const retrievalHitsAt30 = results.reduce(
    (sum, result) =>
      sum +
      result.goldArticles.filter((gold) =>
        result.retrieval.some(
          (row) => row.rank <= 30 && goldArticlesMatch(gold, row),
        ),
      ).length,
    0,
  );

  let goldNewIn21To30InFinalContext = 0;
  let goldNewIn21To30InRerankTop5 = 0;
  let goldNewIn21To30Count = 0;

  for (const result of results) {
    for (const gold of result.metrics.goldNewInRanks21To30) {
      goldNewIn21To30Count += 1;
      if (result.metrics.finalContextGoldHits.some((hit) => goldArticlesMatch(hit, gold))) {
        goldNewIn21To30InFinalContext += 1;
      }
      if (
        result.reranking.some(
          (row) => row.rank <= 5 && goldArticlesMatch(gold, row),
        )
      ) {
        goldNewIn21To30InRerankTop5 += 1;
      }
    }
  }

  const finalGoldHits = results.reduce(
    (sum, result) => sum + result.metrics.finalContextGoldHits.length,
    0,
  );

  return {
    retrievalGoldRecallAt20: goldTotal ? goldHitsAt20 / goldTotal : 0,
    retrievalGoldRecallAt30: goldTotal ? retrievalHitsAt30 / goldTotal : 0,
    finalContextGoldRecall: goldTotal ? finalGoldHits / goldTotal : 0,
    finalContextFullCoverageRate: average(
      results.map((result) =>
        result.metrics.finalContextFullCoverage ? 1 : 0,
      ),
    ),
    correctness: average(results.map((result) => result.judge.correctness)),
    completeness: average(results.map((result) => result.judge.completeness)),
    groundedness: average(results.map((result) => result.judge.groundedness)),
    sourceRelevance: average(
      results.map((result) => result.sourceJudge.sourceRelevance),
    ),
    sourceCoverage: average(
      results.map((result) => result.sourceJudge.sourceCoverage),
    ),
    abstentionCorrectRate: average(
      results.map((result) => (result.judge.abstentionCorrect ? 1 : 0)),
    ),
    avgLatencyMs: average(
      results.map((result) => result.profiling.answerPipelineTotalMs),
    ),
    goldNewIn21To30Count,
    goldNewIn21To30InFinalContext,
    goldNewIn21To30InRerankTop5,
  };
}

export function classifyTop30SmokeDecision(input: {
  smoke: SmokeAggregateMetrics;
  baseline: BaselineE2ERoutingMetrics;
  depthBenchmarkRecallAt20?: number;
}): {
  category: Top30SmokeDecision;
  rationale: string;
  nextStep: string;
} {
  const deltaCompleteness = input.smoke.completeness - input.baseline.completeness;
  const deltaCorrectness = input.smoke.correctness - input.baseline.correctness;
  const deltaSourceCoverage =
    input.smoke.sourceCoverage - input.baseline.sourceCoverage;
  const deltaGroundedness =
    input.smoke.groundedness - input.baseline.groundedness;
  const retrievalGain =
    input.smoke.retrievalGoldRecallAt30 -
    (input.depthBenchmarkRecallAt20 ?? input.smoke.retrievalGoldRecallAt20);

  const usefulInPipeline =
    input.smoke.goldNewIn21To30InFinalContext >= 2 &&
    (deltaCompleteness >= 0.15 || deltaSourceCoverage >= 0.15);

  if (
    usefulInPipeline &&
    deltaGroundedness >= -0.1 &&
    (deltaCompleteness >= 0.1 || deltaCorrectness >= 0.1)
  ) {
    return {
      category: 'TOPK_30_JUSTIFIED',
      rationale:
        'Des gold 21-30 atteignent le contexte final avec gain judge mesurable sans chute groundedness.',
      nextStep:
        'Valider en changement production retrievalTopK=30 puis mini E2E de regression (hors ce smoke).',
    };
  }

  if (
    input.smoke.goldNewIn21To30Count > 0 &&
    input.smoke.goldNewIn21To30InFinalContext === 0 &&
    retrievalGain > 0.03
  ) {
    return {
      category: 'TOPK_30_NOT_USEFUL',
      rationale:
        'Recall retrieval @30 augmente mais les nouveaux candidats 21-30 n atteignent pas le contexte final (goulot rerank/filter).',
      nextStep:
        'Ne pas augmenter topK; experimenter reranking ou matching semantique sur cas meme-corpus.',
    };
  }

  if (
    input.smoke.goldNewIn21To30InFinalContext > 0 &&
    deltaCompleteness < 0.05 &&
    deltaSourceCoverage < 0.05
  ) {
    return {
      category: 'TOPK_30_MIXED',
      rationale:
        'Quelques gold 21-30 entrent en contexte mais le gain judge global reste faible.',
      nextStep:
        'Analyser question par question les cas gagnants vs rerank rejects avant tout changement prod.',
    };
  }

  if (retrievalGain >= 0.05 && deltaCompleteness >= 0.05) {
    return {
      category: 'TOPK_30_JUSTIFIED',
      rationale: 'Gain retrieval @30 corr?l? ? un gain completeness sur la cohorte.',
      nextStep: 'Smoke de regression cible puis passage retrievalTopK=30.',
    };
  }

  return {
    category: 'TOPK_30_NOT_USEFUL',
    rationale:
      'Pas de gain RAG final suffisant pour justifier topK=30 sur cette cohorte.',
    nextStep: 'Poursuivre piste semantique/hybrid sans augmenter topK.',
  };
}

export function buildGainAnalysisRows(
  results: RetrievalTop30SmokeQuestionResult[],
  baselineByQuestion: Map<
    string,
    { correctness: number; completeness: number; sourceCoverage: number }
  >,
): Array<{
  questionId: string;
  gold: GoldArticle;
  rank20: number | null;
  rank30: number | null;
  jinaRank: number | null;
  inFinalContext: boolean;
  judgeDeltaCompleteness: number;
}> {
  const rows: Array<{
    questionId: string;
    gold: GoldArticle;
    rank20: number | null;
    rank30: number | null;
    jinaRank: number | null;
    inFinalContext: boolean;
    judgeDeltaCompleteness: number;
  }> = [];

  for (const result of results) {
    for (const gold of result.metrics.goldNewInRanks21To30) {
      const rank20Row = result.retrieval.find(
        (row) => row.rank <= 20 && goldArticlesMatch(gold, row),
      );
      const rank30Row = result.retrieval.find(
        (row) => row.rank <= 30 && goldArticlesMatch(gold, row),
      );
      const jinaRow = result.reranking.find((row) => goldArticlesMatch(gold, row));
      const baseline = baselineByQuestion.get(result.questionId);
      rows.push({
        questionId: result.questionId,
        gold,
        rank20: rank20Row?.rank ?? null,
        rank30: rank30Row?.rank ?? null,
        jinaRank: jinaRow?.rank ?? null,
        inFinalContext: result.metrics.finalContextGoldHits.some((hit) =>
          goldArticlesMatch(hit, gold),
        ),
        judgeDeltaCompleteness: baseline
          ? result.judge.completeness - baseline.completeness
          : 0,
      });
    }
  }

  return rows;
}
