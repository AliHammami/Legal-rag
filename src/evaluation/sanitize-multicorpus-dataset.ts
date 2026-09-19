import { uniqueGoldArticles } from './gold-article.js';
import type { LegalMulticorpusEvaluationQuestion } from './multicorpus-dataset.types.js';

export function sanitizeMulticorpusDatasetQuestion(
  question: LegalMulticorpusEvaluationQuestion,
): LegalMulticorpusEvaluationQuestion {
  const goldCorpusIds = [...new Set(question.goldCorpusIds)];
  const goldArticles = uniqueGoldArticles(question.goldArticles);
  const sourceArticles = uniqueGoldArticles([
    ...(question.sourceArticles ?? []),
    ...goldArticles,
  ]);

  return {
    ...question,
    goldCorpusIds,
    goldArticles,
    sourceArticles: sourceArticles.length > 0 ? sourceArticles : undefined,
  };
}

export function sanitizeMulticorpusDataset(
  questions: LegalMulticorpusEvaluationQuestion[],
): LegalMulticorpusEvaluationQuestion[] {
  return questions.map(sanitizeMulticorpusDatasetQuestion);
}
