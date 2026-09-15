import {
  E2E_JUDGE_SCORE_MAX,
  E2E_JUDGE_SCORE_MIN,
} from './e2e-judge.constants.js';
import { EvaluationError } from './evaluation.error.js';
import type {
  E2ESourceJudgeRawResponse,
  E2ESourceJudgeResult,
  E2ESourceJudgeScore,
} from './e2e-source-judge.types.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isValidSourceJudgeScore(value: unknown): value is E2ESourceJudgeScore {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= E2E_JUDGE_SCORE_MIN &&
    value <= E2E_JUDGE_SCORE_MAX
  );
}

function parseSourceJudgeScore(
  value: unknown,
  fieldName: string,
  questionId?: string,
): E2ESourceJudgeScore {
  if (!isValidSourceJudgeScore(value)) {
    const suffix = questionId ? ` for question ${questionId}` : '';
    throw new EvaluationError(
      `Invalid source judge ${fieldName}${suffix}: expected integer between ${E2E_JUDGE_SCORE_MIN} and ${E2E_JUDGE_SCORE_MAX}`,
      'SOURCE_JUDGE_RESPONSE_INVALID',
    );
  }

  return value;
}

function parseExplanation(value: unknown, questionId?: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    const suffix = questionId ? ` for question ${questionId}` : '';
    throw new EvaluationError(
      `Invalid source judge explanation${suffix}: expected non-empty string`,
      'SOURCE_JUDGE_RESPONSE_INVALID',
    );
  }

  return value;
}

export function parseE2ESourceJudgeRawResponse(
  value: unknown,
  questionId?: string,
): E2ESourceJudgeRawResponse {
  if (!isRecord(value)) {
    const suffix = questionId ? ` for question ${questionId}` : '';
    throw new EvaluationError(
      `Invalid source judge response${suffix}: expected JSON object`,
      'SOURCE_JUDGE_RESPONSE_INVALID',
    );
  }

  return {
    sourceRelevance: value.sourceRelevance,
    sourceCoverage: value.sourceCoverage,
    explanation: value.explanation,
  };
}

export function parseE2ESourceJudgeResult(
  value: unknown,
  questionId?: string,
): E2ESourceJudgeResult {
  const raw = parseE2ESourceJudgeRawResponse(value, questionId);

  return {
    sourceRelevance: parseSourceJudgeScore(
      raw.sourceRelevance,
      'sourceRelevance',
      questionId,
    ),
    sourceCoverage: parseSourceJudgeScore(
      raw.sourceCoverage,
      'sourceCoverage',
      questionId,
    ),
    explanation: parseExplanation(raw.explanation, questionId),
  };
}

export function parseE2ESourceJudgeResponseJson(
  rawJson: string,
  questionId?: string,
): E2ESourceJudgeResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch (error) {
    const suffix = questionId ? ` for question ${questionId}` : '';
    throw new EvaluationError(
      `Invalid source judge response JSON${suffix}`,
      'SOURCE_JUDGE_RESPONSE_INVALID',
      error,
    );
  }

  return parseE2ESourceJudgeResult(parsed, questionId);
}
