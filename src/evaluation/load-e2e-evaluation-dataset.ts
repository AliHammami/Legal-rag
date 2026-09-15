import { readFile } from 'node:fs/promises';

import { E2E_QUESTION_ID_PATTERN } from './constants.js';
import { EvaluationError } from './evaluation.error.js';
import type { E2EEvaluationQuestion } from './types.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseGoldArticles(
  value: unknown,
  questionId: string,
): string[] {
  if (!Array.isArray(value)) {
    throw new EvaluationError(
      `Invalid evaluation item ${questionId}: goldArticles must be an array`,
      'DATASET_INVALID',
    );
  }

  return value.map((article, articleIndex) => {
    if (typeof article !== 'string' || article.trim().length === 0) {
      throw new EvaluationError(
        `Invalid goldArticles entry for ${questionId} at index ${articleIndex}`,
        'DATASET_INVALID',
      );
    }

    return article;
  });
}

function parseReferenceAnswer(
  value: unknown,
  questionId: string,
): string | null {
  if (value === null) {
    return null;
  }

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new EvaluationError(
      `Invalid evaluation item ${questionId}: referenceAnswer must be a non-empty string or null`,
      'DATASET_INVALID',
    );
  }

  return value;
}

export function parseE2EEvaluationQuestion(
  value: unknown,
  index: number,
): E2EEvaluationQuestion {
  if (!isRecord(value)) {
    throw new EvaluationError(
      `Invalid E2E evaluation item at index ${index}`,
      'DATASET_INVALID',
    );
  }

  if (typeof value.id !== 'string' || value.id.trim().length === 0) {
    throw new EvaluationError(
      `Invalid E2E evaluation item at index ${index}: id must be a non-empty string`,
      'DATASET_INVALID',
    );
  }

  if (typeof value.question !== 'string' || value.question.trim().length === 0) {
    throw new EvaluationError(
      `Invalid E2E evaluation item ${value.id}: question must be a non-empty string`,
      'DATASET_INVALID',
    );
  }

  if (typeof value.expectedAbstention !== 'boolean') {
    throw new EvaluationError(
      `Invalid E2E evaluation item ${value.id}: expectedAbstention must be a boolean`,
      'DATASET_INVALID',
    );
  }

  const goldArticles = parseGoldArticles(value.goldArticles, value.id);
  const referenceAnswer = parseReferenceAnswer(
    value.referenceAnswer,
    value.id,
  );

  return {
    id: value.id,
    question: value.question,
    goldArticles,
    referenceAnswer,
    expectedAbstention: value.expectedAbstention,
  };
}

export async function loadE2EEvaluationDataset(
  datasetPath: string,
): Promise<E2EEvaluationQuestion[]> {
  let raw: string;
  try {
    raw = await readFile(datasetPath, 'utf-8');
  } catch (error) {
    throw new EvaluationError(
      `E2E evaluation dataset not found: ${datasetPath}`,
      'DATASET_NOT_FOUND',
      error,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new EvaluationError(
      `Invalid JSON in E2E evaluation dataset: ${datasetPath}`,
      'DATASET_INVALID',
      error,
    );
  }

  if (!Array.isArray(parsed)) {
    throw new EvaluationError(
      'E2E evaluation dataset must be a JSON array',
      'DATASET_INVALID',
    );
  }

  return parsed.map(parseE2EEvaluationQuestion);
}

export function validateE2EQuestionIds(questions: E2EEvaluationQuestion[]): string[] {
  const duplicateIds: string[] = [];
  const seenIds = new Set<string>();

  for (const question of questions) {
    if (!E2E_QUESTION_ID_PATTERN.test(question.id)) {
      throw new EvaluationError(
        `Invalid E2E question id format: ${question.id}`,
        'DATASET_INVALID',
      );
    }

    if (seenIds.has(question.id)) {
      duplicateIds.push(question.id);
    }

    seenIds.add(question.id);
  }

  return duplicateIds;
}

export function validateE2EQuestionTexts(
  questions: E2EEvaluationQuestion[],
): string[] {
  const duplicateQuestions: string[] = [];
  const seenQuestions = new Map<string, string>();

  for (const question of questions) {
    const normalizedQuestion = question.question.trim();
    const existingId = seenQuestions.get(normalizedQuestion);

    if (existingId) {
      duplicateQuestions.push(`${existingId}, ${question.id}`);
    } else {
      seenQuestions.set(normalizedQuestion, question.id);
    }
  }

  return duplicateQuestions;
}

export function validateE2EReferenceAnswers(
  questions: E2EEvaluationQuestion[],
): string[] {
  const invalidReferenceAnswers: string[] = [];

  for (const question of questions) {
    if (question.expectedAbstention) {
      if (question.referenceAnswer !== null) {
        invalidReferenceAnswers.push(
          `${question.id}: abstention question must have referenceAnswer = null`,
        );
      }
      continue;
    }

    if (question.referenceAnswer === null) {
      invalidReferenceAnswers.push(
        `${question.id}: normal question must have a referenceAnswer`,
      );
    }
  }

  return invalidReferenceAnswers;
}

export function validateE2EGoldArticles(
  questions: E2EEvaluationQuestion[],
): string[] {
  const invalidGoldArticles: string[] = [];

  for (const question of questions) {
    if (question.expectedAbstention) {
      if (question.goldArticles.length > 0) {
        invalidGoldArticles.push(
          `${question.id}: abstention question must have goldArticles = []`,
        );
      }
      continue;
    }

    if (question.goldArticles.length === 0) {
      invalidGoldArticles.push(
        `${question.id}: normal question must have at least one gold article`,
      );
    }
  }

  return invalidGoldArticles;
}

export function validateE2EGoldArticlesInCorpus(
  questions: E2EEvaluationQuestion[],
  corpusArticleNumbers: Set<string>,
): string[] {
  const missingCorpusArticles: string[] = [];

  for (const question of questions) {
    for (const goldArticle of question.goldArticles) {
      if (!corpusArticleNumbers.has(goldArticle)) {
        missingCorpusArticles.push(`${question.id}: ${goldArticle}`);
      }
    }
  }

  return missingCorpusArticles;
}
