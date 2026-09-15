import { dedupeArticleNumbers, average } from './metrics.js';
import type { EvaluationQuestion } from './types.js';
import type { RerankedChunk } from '../reranking/types.js';

export const DEFAULT_RELATIVE_SCORE_THRESHOLDS = [0.2, 0.3, 0.4, 0.5, 0.6, 0.7];

export interface RerankScoreEntry {
  rank: number;
  articleNumber: string;
  score: number;
  relevant: boolean;
}

export interface ConsecutiveScoreGap {
  fromRank: number;
  toRank: number;
  absoluteGap: number;
  ratio: number;
}

export interface LargestScoreGap {
  fromRank: number;
  toRank: number;
  absoluteGap: number;
  ratio: number;
}

export interface QuestionRerankScoreAnalysis {
  question: EvaluationQuestion;
  results: RerankScoreEntry[];
  goldArticlesInTop5: number;
  lastGoldRank: number | null;
  gaps: ConsecutiveScoreGap[];
  relativeToBest: number[];
  largestGap: LargestScoreGap | null;
}

export interface RelativeThresholdSummary {
  threshold: number;
  averageDocumentsKept: number;
  questionsLosingGold: number;
}

export interface RerankerScoreAnalysisReport {
  questions: QuestionRerankScoreAnalysis[];
  thresholdSummaries: RelativeThresholdSummary[];
}

export function isRelevantArticle(
  articleNumber: string,
  goldArticles: string[],
): boolean {
  return goldArticles.includes(articleNumber);
}

export function buildRerankScoreEntries(
  reranked: RerankedChunk[],
  goldArticles: string[],
): RerankScoreEntry[] {
  return reranked.map((chunk, index) => ({
    rank: index + 1,
    articleNumber: chunk.articleNumber,
    score: chunk.rerankScore ?? 0,
    relevant: isRelevantArticle(chunk.articleNumber, goldArticles),
  }));
}

export function countGoldArticlesInTop5(
  resultArticleNumbers: string[],
  goldArticles: string[],
): number {
  const goldSet = new Set(goldArticles);
  const uniqueArticles = dedupeArticleNumbers(resultArticleNumbers);

  return uniqueArticles.filter((articleNumber) => goldSet.has(articleNumber))
    .length;
}

export function findLastGoldRank(entries: RerankScoreEntry[]): number | null {
  const relevantEntries = entries.filter((entry) => entry.relevant);
  if (relevantEntries.length === 0) {
    return null;
  }

  return Math.max(...relevantEntries.map((entry) => entry.rank));
}

export function computeConsecutiveGaps(scores: number[]): ConsecutiveScoreGap[] {
  const gaps: ConsecutiveScoreGap[] = [];

  for (let index = 1; index < scores.length; index++) {
    const previousScore = scores[index - 1]!;
    const currentScore = scores[index]!;

    gaps.push({
      fromRank: index,
      toRank: index + 1,
      absoluteGap: previousScore - currentScore,
      ratio: previousScore === 0 ? 0 : currentScore / previousScore,
    });
  }

  return gaps;
}

export function computeRelativeToBest(scores: number[]): number[] {
  if (scores.length === 0) {
    return [];
  }

  const bestScore = scores[0]!;
  if (bestScore === 0) {
    return scores.map(() => 0);
  }

  return scores.map((score) => score / bestScore);
}

export function findLargestGap(
  gaps: ConsecutiveScoreGap[],
): LargestScoreGap | null {
  if (gaps.length === 0) {
    return null;
  }

  return gaps.reduce((largest, gap) =>
    gap.absoluteGap > largest.absoluteGap ? gap : largest,
  );
}

export function filterByRelativeThreshold(
  entries: RerankScoreEntry[],
  threshold: number,
): RerankScoreEntry[] {
  if (entries.length === 0) {
    return [];
  }

  const bestScore = entries[0]!.score;
  if (bestScore <= 0) {
    return [entries[0]!];
  }

  return entries.filter((entry) => entry.score / bestScore >= threshold);
}

export function wouldLoseGoldFromTop5(
  entries: RerankScoreEntry[],
  threshold: number,
  goldArticles: string[],
): boolean {
  const goldSet = new Set(goldArticles);
  const goldInTop5 = new Set(
    entries
      .filter((entry) => goldSet.has(entry.articleNumber))
      .map((entry) => entry.articleNumber),
  );

  if (goldInTop5.size === 0) {
    return false;
  }

  const keptGold = new Set(
    filterByRelativeThreshold(entries, threshold)
      .filter((entry) => goldSet.has(entry.articleNumber))
      .map((entry) => entry.articleNumber),
  );

  for (const goldArticle of goldInTop5) {
    if (!keptGold.has(goldArticle)) {
      return true;
    }
  }

  return false;
}

export function summarizeRelativeThresholds(
  analyses: QuestionRerankScoreAnalysis[],
  thresholds: number[] = DEFAULT_RELATIVE_SCORE_THRESHOLDS,
): RelativeThresholdSummary[] {
  return thresholds.map((threshold) => {
    const documentsKept = analyses.map(
      (analysis) => filterByRelativeThreshold(analysis.results, threshold).length,
    );
    const questionsLosingGold = analyses.filter((analysis) =>
      wouldLoseGoldFromTop5(
        analysis.results,
        threshold,
        analysis.question.goldArticles,
      ),
    ).length;

    return {
      threshold,
      averageDocumentsKept: average(documentsKept),
      questionsLosingGold,
    };
  });
}

export function analyzeQuestionRerankScores(
  question: EvaluationQuestion,
  reranked: RerankedChunk[],
): QuestionRerankScoreAnalysis {
  const results = buildRerankScoreEntries(reranked, question.goldArticles);
  const scores = results.map((entry) => entry.score);
  const gaps = computeConsecutiveGaps(scores);

  return {
    question,
    results,
    goldArticlesInTop5: countGoldArticlesInTop5(
      reranked.map((chunk) => chunk.articleNumber),
      question.goldArticles,
    ),
    lastGoldRank: findLastGoldRank(results),
    gaps,
    relativeToBest: computeRelativeToBest(scores),
    largestGap: findLargestGap(gaps),
  };
}

export function buildRerankerScoreAnalysisReport(
  analyses: QuestionRerankScoreAnalysis[],
  thresholds: number[] = DEFAULT_RELATIVE_SCORE_THRESHOLDS,
): RerankerScoreAnalysisReport {
  return {
    questions: analyses,
    thresholdSummaries: summarizeRelativeThresholds(analyses, thresholds),
  };
}
