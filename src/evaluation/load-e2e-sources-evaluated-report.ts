import { readFile } from 'node:fs/promises';

import { EvaluationError } from './evaluation.error.js';
import type {
  E2ESourceEvaluationMetadata,
  E2ESourcesEvaluatedReport,
} from './e2e-source-judge.types.js';
import { parseE2EEvaluatedReport } from './load-e2e-evaluated-report.js';
import { parseE2ESourceJudgeResult } from './parse-e2e-source-judge-response.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseSourceEvaluationMetadata(
  value: unknown,
): E2ESourceEvaluationMetadata {
  if (!isRecord(value)) {
    throw new EvaluationError(
      'Invalid sources evaluated file: sourceEvaluation must be an object',
      'SOURCE_EVALUATED_RESULTS_INVALID',
    );
  }

  if (value.type !== 'llm-as-a-judge-sources') {
    throw new EvaluationError(
      'Invalid sources evaluated file: sourceEvaluation.type must be "llm-as-a-judge-sources"',
      'SOURCE_EVALUATED_RESULTS_INVALID',
    );
  }

  if (typeof value.judgeModel !== 'string' || value.judgeModel.trim().length === 0) {
    throw new EvaluationError(
      'Invalid sources evaluated file: sourceEvaluation.judgeModel must be a non-empty string',
      'SOURCE_EVALUATED_RESULTS_INVALID',
    );
  }

  if (typeof value.createdAt !== 'string' || value.createdAt.trim().length === 0) {
    throw new EvaluationError(
      'Invalid sources evaluated file: sourceEvaluation.createdAt must be a non-empty string',
      'SOURCE_EVALUATED_RESULTS_INVALID',
    );
  }

  return {
    type: 'llm-as-a-judge-sources',
    judgeModel: value.judgeModel,
    createdAt: value.createdAt,
  };
}

export function parseE2ESourcesEvaluatedReport(
  value: unknown,
): E2ESourcesEvaluatedReport {
  const baseReport = parseE2EEvaluatedReport(value);

  if (!isRecord(value)) {
    throw new EvaluationError(
      'Invalid sources evaluated file: root must be an object',
      'SOURCE_EVALUATED_RESULTS_INVALID',
    );
  }

  const rawResults = value.results;
  if (!Array.isArray(rawResults)) {
    throw new EvaluationError(
      'Invalid sources evaluated file: results must be an array',
      'SOURCE_EVALUATED_RESULTS_INVALID',
    );
  }

  const results = baseReport.results.map((result, index) => {
    const rawResult = rawResults[index];
    if (!isRecord(rawResult) || !isRecord(rawResult.sourceJudge)) {
      throw new EvaluationError(
        `Invalid sources evaluated result ${result.id}: sourceJudge block is required`,
        'SOURCE_EVALUATED_RESULTS_INVALID',
      );
    }

    const sourceJudge = parseE2ESourceJudgeResult(
      rawResult.sourceJudge,
      result.id,
    );

    return {
      ...result,
      sourceJudge,
    };
  });

  return {
    metadata: baseReport.metadata,
    evaluation: baseReport.evaluation,
    sourceEvaluation: parseSourceEvaluationMetadata(value.sourceEvaluation),
    results,
  };
}

export async function loadE2ESourcesEvaluatedReport(
  path: string,
): Promise<E2ESourcesEvaluatedReport> {
  let raw: string;
  try {
    raw = await readFile(path, 'utf-8');
  } catch (error) {
    throw new EvaluationError(
      `Sources evaluated results not found: ${path}`,
      'SOURCE_EVALUATED_RESULTS_NOT_FOUND',
      error,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new EvaluationError(
      `Invalid JSON in sources evaluated results: ${path}`,
      'SOURCE_EVALUATED_RESULTS_INVALID',
      error,
    );
  }

  return parseE2ESourcesEvaluatedReport(parsed);
}
