import type { E2EDatasetValidationSummary, E2EEvaluationQuestion } from './types.js';
import {
  validateE2EGoldArticles,
  validateE2EGoldArticlesInCorpus,
  validateE2EQuestionIds,
  validateE2EQuestionTexts,
  validateE2EReferenceAnswers,
} from './load-e2e-evaluation-dataset.js';

export function validateE2EEvaluationDataset(
  questions: E2EEvaluationQuestion[],
  corpusArticleNumbers: Set<string>,
): E2EDatasetValidationSummary {
  const duplicateIds = validateE2EQuestionIds(questions);
  const duplicateQuestions = validateE2EQuestionTexts(questions);
  const invalidGoldArticles = validateE2EGoldArticles(questions);
  const invalidReferenceAnswers = validateE2EReferenceAnswers(questions);
  const missingCorpusArticles = validateE2EGoldArticlesInCorpus(
    questions,
    corpusArticleNumbers,
  );

  const abstentionQuestionCount = questions.filter(
    (question) => question.expectedAbstention,
  ).length;

  const issues = [
    ...duplicateIds.map((id) => `duplicate id: ${id}`),
    ...duplicateQuestions.map((entry) => `duplicate question: ${entry}`),
    ...invalidGoldArticles,
    ...invalidReferenceAnswers,
    ...missingCorpusArticles.map((entry) => `missing corpus article: ${entry}`),
  ];

  return {
    questionCount: questions.length,
    normalQuestionCount: questions.length - abstentionQuestionCount,
    abstentionQuestionCount,
    duplicateIds,
    duplicateQuestions,
    invalidGoldArticles,
    invalidReferenceAnswers,
    missingCorpusArticles,
    isValid: issues.length === 0,
  };
}

export function assertValidE2EEvaluationDataset(
  summary: E2EDatasetValidationSummary,
): void {
  if (summary.isValid) {
    return;
  }

  const messages = [
    ...summary.duplicateIds.map((id) => `Duplicate id: ${id}`),
    ...summary.duplicateQuestions.map(
      (entry) => `Duplicate question: ${entry}`,
    ),
    ...summary.invalidGoldArticles,
    ...summary.invalidReferenceAnswers,
    ...summary.missingCorpusArticles.map(
      (entry) => `Missing corpus article: ${entry}`,
    ),
  ];

  throw new Error(messages.join('\n'));
}
