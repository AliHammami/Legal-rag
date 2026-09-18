import { readFile } from 'node:fs/promises';

import { MULTICORPUS_QUESTION_ID_PATTERN } from './constants.js';
import { EvaluationError } from './evaluation.error.js';
import type {
  LegalMulticorpusEvaluationQuestion,
  MulticorpusDifficulty,
  MulticorpusQuestionType,
} from './multicorpus-dataset.types.js';

const VALID_DIFFICULTIES = new Set<MulticorpusDifficulty>(['easy', 'medium', 'hard']);
const VALID_QUESTION_TYPES = new Set<MulticorpusQuestionType>([
  'single-corpus',
  'multi-corpus',
  'ambiguous',
  'out-of-scope',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseStringArray(value: unknown, fieldName: string, questionId: string): string[] {
  if (!Array.isArray(value)) {
    throw new EvaluationError(
      `Invalid evaluation item ${questionId}: ${fieldName} must be an array`,
      'DATASET_INVALID',
    );
  }

  return value.map((entry, index) => {
    if (typeof entry !== 'string' || entry.trim().length === 0) {
      throw new EvaluationError(
        `Invalid ${fieldName} entry for ${questionId} at index ${index}`,
        'DATASET_INVALID',
      );
    }
    return entry;
  });
}

export function parseMulticorpusEvaluationQuestion(
  value: unknown,
  index: number,
): LegalMulticorpusEvaluationQuestion {
  if (!isRecord(value)) {
    throw new EvaluationError(
      `Invalid multicorpus evaluation item at index ${index}`,
      'DATASET_INVALID',
    );
  }

  if (typeof value.id !== 'string' || value.id.trim().length === 0) {
    throw new EvaluationError(
      `Invalid multicorpus evaluation item at index ${index}: id must be a non-empty string`,
      'DATASET_INVALID',
    );
  }

  if (typeof value.question !== 'string' || value.question.trim().length === 0) {
    throw new EvaluationError(
      `Invalid multicorpus evaluation item ${value.id}: question must be a non-empty string`,
      'DATASET_INVALID',
    );
  }

  if (typeof value.referenceAnswer !== 'string' || value.referenceAnswer.trim().length === 0) {
    throw new EvaluationError(
      `Invalid multicorpus evaluation item ${value.id}: referenceAnswer must be a non-empty string`,
      'DATASET_INVALID',
    );
  }

  if (
    typeof value.difficulty !== 'string' ||
    !VALID_DIFFICULTIES.has(value.difficulty as MulticorpusDifficulty)
  ) {
    throw new EvaluationError(
      `Invalid multicorpus evaluation item ${value.id}: difficulty must be easy, medium, or hard`,
      'DATASET_INVALID',
    );
  }

  if (
    typeof value.questionType !== 'string' ||
    !VALID_QUESTION_TYPES.has(value.questionType as MulticorpusQuestionType)
  ) {
    throw new EvaluationError(
      `Invalid multicorpus evaluation item ${value.id}: questionType is invalid`,
      'DATASET_INVALID',
    );
  }

  const goldCorpusIds = parseStringArray(value.goldCorpusIds, 'goldCorpusIds', value.id);
  const goldArticles = parseStringArray(value.goldArticles, 'goldArticles', value.id);

  let sourceArticles: string[] | undefined;
  if (value.sourceArticles !== undefined) {
    sourceArticles = parseStringArray(value.sourceArticles, 'sourceArticles', value.id);
  }

  return {
    id: value.id,
    question: value.question,
    goldCorpusIds,
    goldArticles,
    referenceAnswer: value.referenceAnswer,
    difficulty: value.difficulty as MulticorpusDifficulty,
    questionType: value.questionType as MulticorpusQuestionType,
    sourceArticles,
  };
}

export async function loadMulticorpusEvaluationDataset(
  datasetPath: string,
): Promise<LegalMulticorpusEvaluationQuestion[]> {
  let raw: string;
  try {
    raw = await readFile(datasetPath, 'utf-8');
  } catch (error) {
    throw new EvaluationError(
      `Multicorpus evaluation dataset not found: ${datasetPath}`,
      'DATASET_NOT_FOUND',
      error,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new EvaluationError(
      `Invalid JSON in multicorpus evaluation dataset: ${datasetPath}`,
      'DATASET_INVALID',
      error,
    );
  }

  if (!Array.isArray(parsed)) {
    throw new EvaluationError(
      'Multicorpus evaluation dataset must be a JSON array',
      'DATASET_INVALID',
    );
  }

  return parsed.map(parseMulticorpusEvaluationQuestion);
}

export function validateMulticorpusQuestionIds(
  questions: LegalMulticorpusEvaluationQuestion[],
): string[] {
  const duplicateIds: string[] = [];
  const seenIds = new Set<string>();

  for (const question of questions) {
    if (!MULTICORPUS_QUESTION_ID_PATTERN.test(question.id)) {
      throw new EvaluationError(
        `Invalid multicorpus question id format: ${question.id}`,
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

export function validateMulticorpusQuestionTexts(
  questions: LegalMulticorpusEvaluationQuestion[],
): string[] {
  const duplicateQuestions: string[] = [];
  const seenQuestions = new Map<string, string>();

  for (const question of questions) {
    const normalizedQuestion = normalizeQuestionText(question.question);
    const existingId = seenQuestions.get(normalizedQuestion);

    if (existingId) {
      duplicateQuestions.push(`${existingId}, ${question.id}`);
    } else {
      seenQuestions.set(normalizedQuestion, question.id);
    }
  }

  return duplicateQuestions;
}

export function normalizeQuestionText(question: string): string {
  return question
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
