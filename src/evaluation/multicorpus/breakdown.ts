import type { GoldArticle } from '../gold-article.js';
import type { LegalMulticorpusEvaluationQuestion } from '../multicorpus-dataset.types.js';
import { average } from '../metrics.js';
import type { MetricBreakdownRow } from './types.js';

export function groupQuestionsByType(
  questions: LegalMulticorpusEvaluationQuestion[],
): Map<string, LegalMulticorpusEvaluationQuestion[]> {
  const groups = new Map<string, LegalMulticorpusEvaluationQuestion[]>();
  for (const question of questions) {
    const bucket = groups.get(question.questionType) ?? [];
    bucket.push(question);
    groups.set(question.questionType, bucket);
  }
  return groups;
}

export function groupQuestionsByDifficulty(
  questions: LegalMulticorpusEvaluationQuestion[],
): Map<string, LegalMulticorpusEvaluationQuestion[]> {
  const groups = new Map<string, LegalMulticorpusEvaluationQuestion[]>();
  for (const question of questions) {
    const bucket = groups.get(question.difficulty) ?? [];
    bucket.push(question);
    groups.set(question.difficulty, bucket);
  }
  return groups;
}

export function groupQuestionsByGoldCorpus(
  questions: LegalMulticorpusEvaluationQuestion[],
): Map<string, LegalMulticorpusEvaluationQuestion[]> {
  const groups = new Map<string, LegalMulticorpusEvaluationQuestion[]>();
  for (const question of questions) {
    if (question.goldCorpusIds.length === 0) {
      continue;
    }
    for (const corpusId of question.goldCorpusIds) {
      const bucket = groups.get(corpusId) ?? [];
      bucket.push(question);
      groups.set(corpusId, bucket);
    }
  }
  return groups;
}

export function buildMetricBreakdown<T extends { questionId: string }>(
  questions: LegalMulticorpusEvaluationQuestion[],
  results: T[],
  groups: Map<string, LegalMulticorpusEvaluationQuestion[]>,
  metricExtractor: (result: T) => Record<string, number>,
): MetricBreakdownRow[] {
  const resultById = new Map(results.map((result) => [result.questionId, result]));

  return [...groups.entries()].map(([label, groupedQuestions]) => {
    const metricRows = groupedQuestions
      .map((question) => resultById.get(question.id))
      .filter((result): result is T => result !== undefined)
      .map(metricExtractor);

    const metricKeys = metricRows[0] ? Object.keys(metricRows[0]) : [];
    const metrics: Record<string, number> = {};
    for (const key of metricKeys) {
      metrics[key] = average(metricRows.map((row) => row[key] ?? 0));
    }

    return {
      label,
      count: groupedQuestions.length,
      metrics,
    };
  });
}

export function goldArticlesFromChunks(
  chunks: Array<{ corpusId: string; articleNumber: string }>,
): GoldArticle[] {
  const seen = new Set<string>();
  const articles: GoldArticle[] = [];
  for (const chunk of chunks) {
    const key = `${chunk.corpusId}::${chunk.articleNumber}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    articles.push({
      corpusId: chunk.corpusId,
      articleNumber: chunk.articleNumber,
    });
  }
  return articles;
}
