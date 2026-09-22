import { goldArticlesMatch, type GoldArticle } from '../gold-article.js';
import type { RetrievalTop30SmokeQuestionResult } from './retrieval-top30-smoke-pipeline.js';
import type { HybridRerankFilterVariantResult } from './retrieval-hybrid-rerank-filter-smoke.js';
import type { RankedRetrievalChunk } from './retrieval-depth-benchmark.js';
import { goldRecallInCandidateSet } from './retrieval-hybrid-metrics.js';

export type MiniRegressionDecision =
  | 'HYBRID_NON_REGRESSION_PASS'
  | 'HYBRID_REGRESSION'
  | 'HYBRID_INCONCLUSIVE';

export type QuestionComparisonOutcome =
  | 'union_improves'
  | 'union_degrades'
  | 'equivalent';

export interface MiniRegressionJudgeSnapshot {
  correctness: number;
  completeness: number;
  groundedness: number;
  sourceRelevance: number;
  sourceCoverage: number;
  abstentionCorrect: boolean;
}

export interface MiniRegressionVariantRecord {
  variant: 'vector_top30' | 'union_hybrid';
  retrievalCandidates: RankedRetrievalChunk[];
  retrievalGoldRecall: number;
  retrievalFullCoverage: boolean;
  retrievalCorpusCoverage: number | null;
  jinaTop5: HybridRerankFilterVariantResult['jinaTop5'];
  finalContextChunkIds: string[];
  finalContextGoldArticles: GoldArticle[];
  finalContextFullCoverage: boolean;
  answer: string;
  judge: MiniRegressionJudgeSnapshot;
  error: string | null;
}

export interface MiniRegressionQuestionBenchmark {
  questionId: string;
  question: string;
  questionType: string;
  goldArticles: GoldArticle[];
  routing: {
    decision: string;
    corpusIds: string[];
    abstain?: boolean;
  };
  vector: MiniRegressionVariantRecord;
  union: MiniRegressionVariantRecord;
  comparison: {
    outcome: QuestionComparisonOutcome;
    sameAnswer: boolean;
    goldAddedByUnion: GoldArticle[];
    scoreDeltaCorrectness: number;
    scoreDeltaCompleteness: number;
  };
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function judgeSnapshotFromTop30(
  result: RetrievalTop30SmokeQuestionResult,
): MiniRegressionJudgeSnapshot {
  return {
    correctness: result.judge.correctness,
    completeness: result.judge.completeness,
    groundedness: result.judge.groundedness,
    sourceRelevance: result.sourceJudge.sourceRelevance,
    sourceCoverage: result.sourceJudge.sourceCoverage,
    abstentionCorrect: result.judge.abstentionCorrect,
  };
}

export function vectorVariantFromTop30Smoke(input: {
  result: RetrievalTop30SmokeQuestionResult;
}): MiniRegressionVariantRecord {
  const retrievalCandidates: RankedRetrievalChunk[] = input.result.retrieval.map(
    (row) => ({
      rank: row.rank,
      chunkId: row.chunkId,
      corpusId: row.corpusId,
      articleNumber: row.articleNumber,
      distance: row.distance,
    }),
  );
  const recall = goldRecallInCandidateSet(
    input.result.goldArticles,
    retrievalCandidates,
  );
  const finalGold = input.result.goldArticles.filter((gold) =>
    input.result.finalContext.sources.some((source) =>
      goldArticlesMatch(gold, source),
    ),
  );
  return {
    variant: 'vector_top30',
    retrievalCandidates,
    retrievalGoldRecall: recall.recall,
    retrievalFullCoverage: input.result.metrics.finalContextFullCoverage,
    retrievalCorpusCoverage: input.result.metrics.retrievalCorpusCoverageAt30,
    jinaTop5: input.result.reranking.map((row) => ({
      rank: row.rank,
      chunkId: row.chunkId,
      corpusId: row.corpusId,
      articleNumber: row.articleNumber,
      score: row.score,
    })),
    finalContextChunkIds: input.result.finalContext.chunkIds,
    finalContextGoldArticles: finalGold,
    finalContextFullCoverage: input.result.metrics.finalContextFullCoverage,
    answer: input.result.generation.answer,
    judge: judgeSnapshotFromTop30(input.result),
    error: null,
  };
}

export function unionVariantFromArtifacts(input: {
  unionCandidates: RankedRetrievalChunk[];
  smokeUnion: HybridRerankFilterVariantResult;
  goldArticles: GoldArticle[];
  goldCorpusIds: string[];
  questionType: string;
  answer: string;
  judge: MiniRegressionJudgeSnapshot;
  error?: string | null;
}): MiniRegressionVariantRecord {
  const recall = goldRecallInCandidateSet(
    input.goldArticles,
    input.unionCandidates,
  );
  const kept = input.smokeUnion.filterRows.filter((row) => row.kept);
  const finalGold = input.goldArticles.filter((gold) =>
    kept.some((row) => goldArticlesMatch(gold, row)),
  );
  let corpusCoverage: number | null = null;
  if (input.questionType === 'multi-corpus') {
    const hitCorpora = new Set(finalGold.map((gold) => gold.corpusId));
    corpusCoverage = input.goldCorpusIds.filter((corpusId) =>
      hitCorpora.has(corpusId),
    ).length;
  }
  return {
    variant: 'union_hybrid',
    retrievalCandidates: input.unionCandidates,
    retrievalGoldRecall: recall.recall,
    retrievalFullCoverage: input.smokeUnion.afterFilter.fullCoverage,
    retrievalCorpusCoverage: corpusCoverage,
    jinaTop5: input.smokeUnion.jinaTop5,
    finalContextChunkIds: input.smokeUnion.finalContextChunkIds,
    finalContextGoldArticles: finalGold,
    finalContextFullCoverage: input.smokeUnion.afterFilter.fullCoverage,
    answer: input.answer,
    judge: input.judge,
    error: input.error ?? null,
  };
}

export function compareQuestionVariants(input: {
  vector: MiniRegressionVariantRecord;
  union: MiniRegressionVariantRecord;
  goldArticles: GoldArticle[];
}): MiniRegressionQuestionBenchmark['comparison'] {
  const vectorGoldKeys = new Set(
    input.vector.finalContextGoldArticles.map(
      (gold) => `${gold.corpusId}:${gold.articleNumber}`,
    ),
  );
  const goldAddedByUnion = input.union.finalContextGoldArticles.filter(
    (gold) => !vectorGoldKeys.has(`${gold.corpusId}:${gold.articleNumber}`),
  );

  const scoreDeltaCorrectness =
    input.union.judge.correctness - input.vector.judge.correctness;
  const scoreDeltaCompleteness =
    input.union.judge.completeness - input.vector.judge.completeness;
  const combinedDelta = scoreDeltaCorrectness + scoreDeltaCompleteness;

  let outcome: QuestionComparisonOutcome = 'equivalent';
  if (combinedDelta >= 0.5) {
    outcome = 'union_improves';
  } else if (combinedDelta <= -0.5) {
    outcome = 'union_degrades';
  }

  const sameAnswer =
    input.vector.answer.trim() === input.union.answer.trim();

  return {
    outcome,
    sameAnswer,
    goldAddedByUnion,
    scoreDeltaCorrectness,
    scoreDeltaCompleteness,
  };
}

export function aggregateMiniRegressionSummary(
  results: MiniRegressionQuestionBenchmark[],
): {
  vector: ReturnType<typeof aggregateVariantJudge>;
  union: ReturnType<typeof aggregateVariantJudge>;
  delta: {
    correctness: number;
    completeness: number;
    groundedness: number;
    sourceRelevance: number;
    sourceCoverage: number;
  };
  retrieval: {
    vectorGoldRecall: number;
    unionGoldRecall: number;
    vectorFinalGoldRecall: number;
    unionFinalGoldRecall: number;
    vectorFullCoverageRate: number;
    unionFullCoverageRate: number;
  };
  comparisonCounts: {
    unionImproves: number;
    unionDegrades: number;
    equivalent: number;
    identicalAnswers: number;
  };
} {
  const vectorJudge = results.map((result) => result.vector.judge);
  const unionJudge = results.map((result) => result.union.judge);
  const vectorAgg = aggregateVariantJudge(vectorJudge);
  const unionAgg = aggregateVariantJudge(unionJudge);

  const goldTotal = results.reduce(
    (sum, result) => sum + result.goldArticles.length,
    0,
  );
  const vectorRetrievalHits = results.reduce(
    (sum, result) =>
      sum + result.goldArticles.length * result.vector.retrievalGoldRecall,
    0,
  );
  const unionRetrievalHits = results.reduce(
    (sum, result) =>
      sum + result.goldArticles.length * result.union.retrievalGoldRecall,
    0,
  );
  const vectorFinalHits = results.reduce(
    (sum, result) => sum + result.vector.finalContextGoldArticles.length,
    0,
  );
  const unionFinalHits = results.reduce(
    (sum, result) => sum + result.union.finalContextGoldArticles.length,
    0,
  );

  return {
    vector: vectorAgg,
    union: unionAgg,
    delta: {
      correctness: unionAgg.correctness - vectorAgg.correctness,
      completeness: unionAgg.completeness - vectorAgg.completeness,
      groundedness: unionAgg.groundedness - vectorAgg.groundedness,
      sourceRelevance: unionAgg.sourceRelevance - vectorAgg.sourceRelevance,
      sourceCoverage: unionAgg.sourceCoverage - vectorAgg.sourceCoverage,
    },
    retrieval: {
      vectorGoldRecall: goldTotal ? vectorRetrievalHits / goldTotal : 0,
      unionGoldRecall: goldTotal ? unionRetrievalHits / goldTotal : 0,
      vectorFinalGoldRecall: goldTotal ? vectorFinalHits / goldTotal : 0,
      unionFinalGoldRecall: goldTotal ? unionFinalHits / goldTotal : 0,
      vectorFullCoverageRate: average(
        results.map((result) => (result.vector.finalContextFullCoverage ? 1 : 0)),
      ),
      unionFullCoverageRate: average(
        results.map((result) => (result.union.finalContextFullCoverage ? 1 : 0)),
      ),
    },
    comparisonCounts: {
      unionImproves: results.filter(
        (result) => result.comparison.outcome === 'union_improves',
      ).length,
      unionDegrades: results.filter(
        (result) => result.comparison.outcome === 'union_degrades',
      ).length,
      equivalent: results.filter(
        (result) => result.comparison.outcome === 'equivalent',
      ).length,
      identicalAnswers: results.filter((result) => result.comparison.sameAnswer)
        .length,
    },
  };
}

function aggregateVariantJudge(rows: MiniRegressionJudgeSnapshot[]): {
  correctness: number;
  completeness: number;
  groundedness: number;
  sourceRelevance: number;
  sourceCoverage: number;
  abstentionCorrectRate: number;
} {
  return {
    correctness: average(rows.map((row) => row.correctness)),
    completeness: average(rows.map((row) => row.completeness)),
    groundedness: average(rows.map((row) => row.groundedness)),
    sourceRelevance: average(rows.map((row) => row.sourceRelevance)),
    sourceCoverage: average(rows.map((row) => row.sourceCoverage)),
    abstentionCorrectRate: average(
      rows.map((row) => (row.abstentionCorrect ? 1 : 0)),
    ),
  };
}

export function classifyHybridMiniRegressionDecision(input: {
  summary: ReturnType<typeof aggregateMiniRegressionSummary>;
  cohortSize: number;
}): {
  category: MiniRegressionDecision;
  rationale: string;
  nextStep: string;
} {
  const { summary, cohortSize } = input;
  const { comparisonCounts, delta } = summary;

  if (cohortSize < 10) {
    return {
      category: 'HYBRID_INCONCLUSIVE',
      rationale: `Cohorte ${cohortSize} questions (< 10).`,
      nextStep: 'Elargir la cohorte avant decision integration.',
    };
  }

  const significantRegression =
    delta.correctness <= -0.35 ||
    delta.completeness <= -0.35 ||
    comparisonCounts.unionDegrades >= 5;

  const clearPass =
    delta.correctness >= -0.1 &&
    delta.completeness >= -0.1 &&
    comparisonCounts.unionDegrades <= comparisonCounts.unionImproves &&
    comparisonCounts.unionDegrades <= 3;

  const clearImprovement =
    delta.correctness >= 0.15 || delta.completeness >= 0.2;

  if (significantRegression) {
    return {
      category: 'HYBRID_REGRESSION',
      rationale:
        'Regression judge significative vs pipeline Vector topK=30 sur la mini-cohorte.',
      nextStep: 'Ne pas integrer hybrid; investiguer les questions union_degrades.',
    };
  }

  if (clearPass && (clearImprovement || comparisonCounts.unionImproves > 0)) {
    return {
      category: 'HYBRID_NON_REGRESSION_PASS',
      rationale:
        'Union maintient ou ameliore correctness/completeness sans regression majeure.',
      nextStep:
        'Integrer Union hybrid retrieval en evaluation/staging puis smoke prod restreint avant merge production.',
    };
  }

  if (
    comparisonCounts.unionImproves > 0 &&
    comparisonCounts.unionDegrades > 0
  ) {
    return {
      category: 'HYBRID_INCONCLUSIVE',
      rationale: `Resultats mixtes (${comparisonCounts.unionImproves} ameliorations, ${comparisonCounts.unionDegrades} degradations).`,
      nextStep:
        'Analyser manuellement les cas union_degrades avant integration.',
    };
  }

  return {
    category: 'HYBRID_INCONCLUSIVE',
    rationale: 'Signal insuffisant pour conclure non-regression ou regression.',
    nextStep: 'Repeter avec cohorte elargie ou revue manuelle des 30 paires.',
  };
}

export function buildMiniRegressionReadme(input: {
  cohortRules: string;
  parameters: Record<string, unknown>;
  decision: ReturnType<typeof classifyHybridMiniRegressionDecision>;
}): string {
  return `# Mini regression hybrid Union vs Vector topK=30

## Pipelines

- **A (Vector)** : routing replay ? vector retrieval topK=30 ? Jina top5 ? dynamic filter 0.40 ? generation ? judge
- **B (Union)** : routing replay ? hybrid Union (Vector@50+BM25@50) ? Jina top5 ? dynamic filter 0.40 ? generation ? judge

## Selection (${input.cohortRules})

## Parametres

\`\`\`json
${JSON.stringify(input.parameters, null, 2)}
\`\`\`

## Decision

**${input.decision.category}**

${input.decision.rationale}

${input.decision.nextStep}
`;
}
