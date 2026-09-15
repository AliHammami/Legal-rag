import {
  countGoldArticlesInTop5,
  filterByRelativeThreshold,
  type QuestionRerankScoreAnalysis,
  type RerankScoreEntry,
} from './analyze-reranker-scores.js';
import { average, dedupeArticleNumbers } from './metrics.js';

export const SENSITIVITY_RELATIVE_SCORE_THRESHOLDS = [
  0.3, 0.35, 0.375, 0.4, 0.425, 0.45, 0.5,
] as const;

export interface GoldArticleThresholdDetail {
  articleNumber: string;
  relativeScore: number;
}

export interface QuestionThresholdEvaluation {
  questionId: string;
  keptDocumentsCount: number;
  keptArticles: string[];
  goldKept: string[];
  goldLost: string[];
  lostGoldDetails: GoldArticleThresholdDetail[];
  bestEntry: {
    articleNumber: string;
    score: number;
  };
  lastGoldKept: GoldArticleThresholdDetail | null;
  losesGold: boolean;
}

export interface RelativeScoreThresholdEvaluation {
  threshold: number;
  averageDocumentsKept: number;
  minDocumentsKept: number;
  maxDocumentsKept: number;
  totalGoldInTop5: number;
  totalGoldKept: number;
  totalGoldLost: number;
  questionsLosingGold: number;
  goldRecallPercent: number;
  questionEvaluations: QuestionThresholdEvaluation[];
}

export interface ThresholdSensitivityRecommendation {
  lowestSafeThreshold: number;
  highestSafeThreshold: number;
  averageDocumentsAtHighestSafe: number;
  marginToNextFailurePercentPoints: number;
  nextFailingThreshold: number | null;
}

export interface ThresholdSensitivityReport {
  thresholdEvaluations: RelativeScoreThresholdEvaluation[];
  recommendation: ThresholdSensitivityRecommendation | null;
}

export function computeEntryRelativeScore(
  entry: RerankScoreEntry,
  bestScore: number,
): number {
  if (bestScore <= 0) {
    return entry.rank === 1 ? 1 : 0;
  }

  return entry.score / bestScore;
}

function getGoldArticlesInTop5(
  entries: RerankScoreEntry[],
  goldArticles: string[],
): string[] {
  const goldSet = new Set(goldArticles);
  return dedupeArticleNumbers(
    entries
      .filter((entry) => goldSet.has(entry.articleNumber))
      .map((entry) => entry.articleNumber),
  );
}

export function evaluateQuestionAtThreshold(
  analysis: QuestionRerankScoreAnalysis,
  threshold: number,
): QuestionThresholdEvaluation {
  const keptEntries = filterByRelativeThreshold(analysis.results, threshold);
  const bestEntry = analysis.results[0]!;
  const goldInTop5 = getGoldArticlesInTop5(
    analysis.results,
    analysis.question.goldArticles,
  );
  const keptArticles = dedupeArticleNumbers(
    keptEntries.map((entry) => entry.articleNumber),
  );
  const keptGoldSet = new Set(
    keptArticles.filter((articleNumber) =>
      analysis.question.goldArticles.includes(articleNumber),
    ),
  );
  const goldKept = goldInTop5.filter((articleNumber) =>
    keptGoldSet.has(articleNumber),
  );
  const goldLost = goldInTop5.filter(
    (articleNumber) => !keptGoldSet.has(articleNumber),
  );

  const goldKeptEntries = keptEntries.filter((entry) =>
    analysis.question.goldArticles.includes(entry.articleNumber),
  );
  const lastGoldKeptEntry = goldKeptEntries.at(-1) ?? null;
  const lostGoldDetails = goldLost.map((articleNumber) => {
    const entry = analysis.results.find(
      (result) => result.articleNumber === articleNumber,
    )!;

    return {
      articleNumber,
      relativeScore: computeEntryRelativeScore(entry, bestEntry.score),
    };
  });

  return {
    questionId: analysis.question.id,
    keptDocumentsCount: keptEntries.length,
    keptArticles,
    goldKept,
    goldLost,
    lostGoldDetails,
    bestEntry: {
      articleNumber: bestEntry.articleNumber,
      score: bestEntry.score,
    },
    lastGoldKept: lastGoldKeptEntry
      ? {
          articleNumber: lastGoldKeptEntry.articleNumber,
          relativeScore: computeEntryRelativeScore(
            lastGoldKeptEntry,
            bestEntry.score,
          ),
        }
      : null,
    losesGold: goldLost.length > 0,
  };
}

export function evaluateRelativeScoreThreshold(
  analyses: QuestionRerankScoreAnalysis[],
  threshold: number,
): RelativeScoreThresholdEvaluation {
  const questionEvaluations = analyses.map((analysis) =>
    evaluateQuestionAtThreshold(analysis, threshold),
  );
  const documentsKept = questionEvaluations.map(
    (evaluation) => evaluation.keptDocumentsCount,
  );

  let totalGoldInTop5 = 0;

  for (const analysis of analyses) {
    totalGoldInTop5 += countGoldArticlesInTop5(
      analysis.results.map((entry) => entry.articleNumber),
      analysis.question.goldArticles,
    );
  }

  const totalGoldKept = questionEvaluations.reduce(
    (sum, evaluation) => sum + evaluation.goldKept.length,
    0,
  );

  const totalGoldLost = totalGoldInTop5 - totalGoldKept;
  const questionsLosingGold = questionEvaluations.filter(
    (evaluation) => evaluation.losesGold,
  ).length;

  return {
    threshold,
    averageDocumentsKept: average(documentsKept),
    minDocumentsKept: documentsKept.length === 0 ? 0 : Math.min(...documentsKept),
    maxDocumentsKept: documentsKept.length === 0 ? 0 : Math.max(...documentsKept),
    totalGoldInTop5,
    totalGoldKept,
    totalGoldLost,
    questionsLosingGold,
    goldRecallPercent:
      totalGoldInTop5 === 0 ? 100 : (totalGoldKept / totalGoldInTop5) * 100,
    questionEvaluations,
  };
}

export function evaluateRelativeScoreThresholds(
  analyses: QuestionRerankScoreAnalysis[],
  thresholds: readonly number[] = SENSITIVITY_RELATIVE_SCORE_THRESHOLDS,
): RelativeScoreThresholdEvaluation[] {
  return thresholds.map((threshold) =>
    evaluateRelativeScoreThreshold(analyses, threshold),
  );
}

export function computeThresholdSensitivityRecommendation(
  thresholdEvaluations: RelativeScoreThresholdEvaluation[],
): ThresholdSensitivityRecommendation | null {
  const safeEvaluations = thresholdEvaluations.filter(
    (evaluation) => evaluation.questionsLosingGold === 0,
  );

  if (safeEvaluations.length === 0) {
    return null;
  }

  const sortedThresholds = [...thresholdEvaluations].sort(
    (left, right) => left.threshold - right.threshold,
  );
  const lowestSafeThreshold = Math.min(
    ...safeEvaluations.map((evaluation) => evaluation.threshold),
  );
  const highestSafeThreshold = Math.max(
    ...safeEvaluations.map((evaluation) => evaluation.threshold),
  );
  const highestSafeEvaluation = safeEvaluations.find(
    (evaluation) => evaluation.threshold === highestSafeThreshold,
  )!;
  const nextFailingThreshold =
    sortedThresholds.find(
      (evaluation) =>
        evaluation.threshold > highestSafeThreshold &&
        evaluation.questionsLosingGold > 0,
    )?.threshold ?? null;

  return {
    lowestSafeThreshold,
    highestSafeThreshold,
    averageDocumentsAtHighestSafe: highestSafeEvaluation.averageDocumentsKept,
    marginToNextFailurePercentPoints:
      nextFailingThreshold === null
        ? 0
        : (nextFailingThreshold - highestSafeThreshold) * 100,
    nextFailingThreshold,
  };
}

export function buildThresholdSensitivityReport(
  analyses: QuestionRerankScoreAnalysis[],
  thresholds: readonly number[] = SENSITIVITY_RELATIVE_SCORE_THRESHOLDS,
): ThresholdSensitivityReport {
  const thresholdEvaluations = evaluateRelativeScoreThresholds(
    analyses,
    thresholds,
  );

  return {
    thresholdEvaluations,
    recommendation: computeThresholdSensitivityRecommendation(
      thresholdEvaluations,
    ),
  };
}
