import { readFile } from 'node:fs/promises';

import { EvaluationError } from './evaluation.error.js';
import type { E2EEvaluationReport, E2EQuestionResult } from './e2e-evaluation.types.js';
import type { LoadE2EEvaluationResultsOptions } from './e2e-judge.types.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseMetadata(value: unknown): E2EEvaluationReport['metadata'] {
  if (!isRecord(value)) {
    throw new EvaluationError(
      'Invalid E2E results file: metadata must be an object',
      'RESULTS_INVALID',
    );
  }

  const requiredStringFields = [
    'dataset',
    'generationModel',
    'embeddingModel',
    'rerankerModel',
    'createdAt',
  ] as const;

  for (const field of requiredStringFields) {
    if (typeof value[field] !== 'string' || value[field].trim().length === 0) {
      throw new EvaluationError(
        `Invalid E2E results metadata: ${field} must be a non-empty string`,
        'RESULTS_INVALID',
      );
    }
  }

  if (typeof value.questionCount !== 'number' || value.questionCount <= 0) {
    throw new EvaluationError(
      'Invalid E2E results metadata: questionCount must be a positive number',
      'RESULTS_INVALID',
    );
  }

  if (typeof value.contextThreshold !== 'number') {
    throw new EvaluationError(
      'Invalid E2E results metadata: contextThreshold must be a number',
      'RESULTS_INVALID',
    );
  }

  return {
    dataset: value.dataset as string,
    questionCount: value.questionCount as number,
    generationModel: value.generationModel as string,
    embeddingModel: value.embeddingModel as string,
    rerankerModel: value.rerankerModel as string,
    contextThreshold: value.contextThreshold as number,
    createdAt: value.createdAt as string,
  };
}

function parseQuestionResult(value: unknown, index: number): E2EQuestionResult {
  if (!isRecord(value)) {
    throw new EvaluationError(
      `Invalid E2E result at index ${index}`,
      'RESULTS_INVALID',
    );
  }

  if (typeof value.id !== 'string' || value.id.trim().length === 0) {
    throw new EvaluationError(
      `Invalid E2E result at index ${index}: id must be a non-empty string`,
      'RESULTS_INVALID',
    );
  }

  if (typeof value.status !== 'string') {
    throw new EvaluationError(
      `Invalid E2E result ${value.id}: status is required`,
      'RESULTS_INVALID',
    );
  }

  if (value.status === 'error') {
    if (!isRecord(value.error)) {
      throw new EvaluationError(
        `Invalid E2E result ${value.id}: error snapshot is required`,
        'RESULTS_INVALID',
      );
    }

    if (
      typeof value.error.message !== 'string' ||
      typeof value.error.code !== 'string'
    ) {
      throw new EvaluationError(
        `Invalid E2E result ${value.id}: error.message and error.code are required`,
        'RESULTS_INVALID',
      );
    }
  }

  if (value.status === 'success') {
    if (typeof value.generatedAnswer !== 'string') {
      throw new EvaluationError(
        `Invalid E2E result ${value.id}: generatedAnswer is required for success results`,
        'RESULTS_INVALID',
      );
    }

    if (typeof value.context !== 'string') {
      throw new EvaluationError(
        `Invalid E2E result ${value.id}: context is required for success results`,
        'RESULTS_INVALID',
      );
    }
  }

  return value as unknown as E2EQuestionResult;
}

export function parseE2EEvaluationReport(value: unknown): E2EEvaluationReport {
  if (!isRecord(value)) {
    throw new EvaluationError(
      'Invalid E2E results file: root must be an object',
      'RESULTS_INVALID',
    );
  }

  if (!Array.isArray(value.results)) {
    throw new EvaluationError(
      'Invalid E2E results file: results must be an array',
      'RESULTS_INVALID',
    );
  }

  return {
    metadata: parseMetadata(value.metadata),
    results: value.results.map(parseQuestionResult),
  };
}

export async function loadE2EEvaluationResults(
  resultsPath: string,
  options: LoadE2EEvaluationResultsOptions = {},
): Promise<E2EEvaluationReport> {
  let raw: string;
  try {
    raw = await readFile(resultsPath, 'utf-8');
  } catch (error) {
    throw new EvaluationError(
      `E2E evaluation results not found: ${resultsPath}`,
      'RESULTS_NOT_FOUND',
      error,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new EvaluationError(
      `Invalid JSON in E2E evaluation results: ${resultsPath}`,
      'RESULTS_INVALID',
      error,
    );
  }

  const report = parseE2EEvaluationReport(parsed);

  if (
    options.expectedQuestionCount !== undefined &&
    report.results.length !== options.expectedQuestionCount
  ) {
    throw new EvaluationError(
      `E2E results contain ${report.results.length} questions, expected ${options.expectedQuestionCount}`,
      'RESULTS_INVALID',
    );
  }

  if (report.results.length !== report.metadata.questionCount) {
    throw new EvaluationError(
      `E2E results metadata.questionCount (${report.metadata.questionCount}) does not match results length (${report.results.length})`,
      'RESULTS_INVALID',
    );
  }

  return report;
}

export function assertE2EResultJudgeable(
  result: E2EQuestionResult,
): asserts result is Extract<E2EQuestionResult, { status: 'success' }> {
  if (result.status !== 'success') {
    throw new EvaluationError(
      `Cannot judge question ${result.id}: pipeline result status is "${result.status}"`,
      'RESULTS_NOT_JUDGEABLE',
    );
  }
}
