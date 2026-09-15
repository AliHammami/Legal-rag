import { readFile } from 'node:fs/promises';

import { EvaluationError } from './evaluation.error.js';
import type {
  E2EEvaluatedQuestionResult,
  E2EEvaluatedReport,
  E2EEvaluationMetadata,
} from './e2e-judge.types.js';
import { parseE2EJudgeScoreSnapshot } from './parse-e2e-judge-response.js';
import { parseE2EEvaluationReport } from './load-e2e-evaluation-results.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseEvaluationMetadata(value: unknown): E2EEvaluationMetadata {
  if (!isRecord(value)) {
    throw new EvaluationError(
      'Invalid evaluated E2E file: evaluation must be an object',
      'EVALUATED_RESULTS_INVALID',
    );
  }

  if (value.type !== 'llm-as-a-judge') {
    throw new EvaluationError(
      'Invalid evaluated E2E file: evaluation.type must be "llm-as-a-judge"',
      'EVALUATED_RESULTS_INVALID',
    );
  }

  if (typeof value.judgeModel !== 'string' || value.judgeModel.trim().length === 0) {
    throw new EvaluationError(
      'Invalid evaluated E2E file: evaluation.judgeModel must be a non-empty string',
      'EVALUATED_RESULTS_INVALID',
    );
  }

  if (typeof value.createdAt !== 'string' || value.createdAt.trim().length === 0) {
    throw new EvaluationError(
      'Invalid evaluated E2E file: evaluation.createdAt must be a non-empty string',
      'EVALUATED_RESULTS_INVALID',
    );
  }

  if (!Array.isArray(value.criteria) || value.criteria.length === 0) {
    throw new EvaluationError(
      'Invalid evaluated E2E file: evaluation.criteria must be a non-empty array',
      'EVALUATED_RESULTS_INVALID',
    );
  }

  return {
    type: 'llm-as-a-judge',
    judgeModel: value.judgeModel,
    createdAt: value.createdAt,
    criteria: value.criteria as E2EEvaluationMetadata['criteria'],
  };
}

function parseEvaluatedQuestionResult(
  value: unknown,
  index: number,
): E2EEvaluatedQuestionResult {
  if (!isRecord(value)) {
    throw new EvaluationError(
      `Invalid evaluated E2E result at index ${index}`,
      'EVALUATED_RESULTS_INVALID',
    );
  }

  if (typeof value.id !== 'string' || value.id.trim().length === 0) {
    throw new EvaluationError(
      `Invalid evaluated E2E result at index ${index}: id must be a non-empty string`,
      'EVALUATED_RESULTS_INVALID',
    );
  }

  if (value.status === 'success') {
    if (!isRecord(value.judge)) {
      throw new EvaluationError(
        `Invalid evaluated E2E result ${value.id}: judge block is required`,
        'EVALUATED_RESULTS_INVALID',
      );
    }

    parseE2EJudgeScoreSnapshot(value.judge, value.id);
  }

  return value as unknown as E2EEvaluatedQuestionResult;
}

export function parseE2EEvaluatedReport(value: unknown): E2EEvaluatedReport {
  if (!isRecord(value)) {
    throw new EvaluationError(
      'Invalid evaluated E2E file: root must be an object',
      'EVALUATED_RESULTS_INVALID',
    );
  }

  const baseReport = parseE2EEvaluationReport(value);

  if (!Array.isArray(value.results)) {
    throw new EvaluationError(
      'Invalid evaluated E2E file: results must be an array',
      'EVALUATED_RESULTS_INVALID',
    );
  }

  const results = value.results.map(parseEvaluatedQuestionResult);

  for (const result of results) {
    if (result.status !== 'success') {
      throw new EvaluationError(
        `Invalid evaluated E2E result ${result.id}: only success results can be aggregated`,
        'EVALUATED_RESULTS_INVALID',
      );
    }

    if (!result.judge) {
      throw new EvaluationError(
        `Invalid evaluated E2E result ${result.id}: judge block is required`,
        'EVALUATED_RESULTS_INVALID',
      );
    }
  }

  return {
    metadata: baseReport.metadata,
    evaluation: parseEvaluationMetadata(value.evaluation),
    results,
  };
}

export async function loadE2EEvaluatedReport(
  evaluatedPath: string,
): Promise<E2EEvaluatedReport> {
  let raw: string;
  try {
    raw = await readFile(evaluatedPath, 'utf-8');
  } catch (error) {
    throw new EvaluationError(
      `Evaluated E2E results not found: ${evaluatedPath}`,
      'EVALUATED_RESULTS_NOT_FOUND',
      error,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new EvaluationError(
      `Invalid JSON in evaluated E2E results: ${evaluatedPath}`,
      'EVALUATED_RESULTS_INVALID',
      error,
    );
  }

  const report = parseE2EEvaluatedReport(parsed);

  if (report.results.length === 0) {
    throw new EvaluationError(
      'Evaluated E2E results contain no questions',
      'REPORT_EMPTY_DATASET',
    );
  }

  if (report.results.length !== report.metadata.questionCount) {
    throw new EvaluationError(
      `Evaluated E2E metadata.questionCount (${report.metadata.questionCount}) does not match results length (${report.results.length})`,
      'EVALUATED_RESULTS_INVALID',
    );
  }

  return report;
}
