import { readFile } from 'node:fs/promises';

import { EvaluationError } from './evaluation.error.js';
import type { EvaluationQuestion } from './types.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseEvaluationQuestion(value: unknown, index: number): EvaluationQuestion {
  if (!isRecord(value)) {
    throw new EvaluationError(
      `Invalid evaluation item at index ${index}`,
      'DATASET_INVALID',
    );
  }

  if (typeof value.id !== 'string' || value.id.trim().length === 0) {
    throw new EvaluationError(
      `Invalid evaluation item at index ${index}: id must be a non-empty string`,
      'DATASET_INVALID',
    );
  }

  if (typeof value.question !== 'string' || value.question.trim().length === 0) {
    throw new EvaluationError(
      `Invalid evaluation item ${value.id}: question must be a non-empty string`,
      'DATASET_INVALID',
    );
  }

  if (!Array.isArray(value.goldArticles) || value.goldArticles.length === 0) {
    throw new EvaluationError(
      `Invalid evaluation item ${value.id}: goldArticles must be a non-empty array`,
      'DATASET_INVALID',
    );
  }

  const goldArticles = value.goldArticles.map((article, articleIndex) => {
    if (typeof article !== 'string' || article.trim().length === 0) {
      throw new EvaluationError(
        `Invalid goldArticles entry for ${value.id} at index ${articleIndex}`,
        'DATASET_INVALID',
      );
    }
    return article;
  });

  return {
    id: value.id,
    question: value.question,
    goldArticles,
  };
}

export async function loadEvaluationDataset(
  datasetPath: string,
): Promise<EvaluationQuestion[]> {
  let raw: string;
  try {
    raw = await readFile(datasetPath, 'utf-8');
  } catch (error) {
    throw new EvaluationError(
      `Evaluation dataset not found: ${datasetPath}`,
      'DATASET_NOT_FOUND',
      error,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new EvaluationError(
      `Invalid JSON in evaluation dataset: ${datasetPath}`,
      'DATASET_INVALID',
      error,
    );
  }

  if (!Array.isArray(parsed)) {
    throw new EvaluationError(
      'Evaluation dataset must be a JSON array',
      'DATASET_INVALID',
    );
  }

  const questions = parsed.map(parseEvaluationQuestion);
  const seenIds = new Set<string>();

  for (const question of questions) {
    if (seenIds.has(question.id)) {
      throw new EvaluationError(
        `Duplicate evaluation question id: ${question.id}`,
        'DATASET_DUPLICATE_ID',
      );
    }
    seenIds.add(question.id);
  }

  return questions;
}

export function validateGoldArticlesInCorpus(
  questions: EvaluationQuestion[],
  corpusArticleNumbers: Set<string>,
): void {
  for (const question of questions) {
    for (const goldArticle of question.goldArticles) {
      if (!corpusArticleNumbers.has(goldArticle)) {
        throw new EvaluationError(
          `Gold article not found in corpus for ${question.id}: ${goldArticle}`,
          'GOLD_ARTICLE_MISSING',
        );
      }
    }
  }
}
