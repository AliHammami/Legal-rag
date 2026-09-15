import {
  E2E_JUDGE_SCORE_MAX,
  E2E_JUDGE_SCORE_MIN,
} from './e2e-judge.constants.js';
import { EvaluationError } from './evaluation.error.js';
import type {
  E2EJudgeRawResponse,
  E2EJudgeResult,
  E2EJudgeScoreSnapshot,
} from './e2e-judge.types.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isValidJudgeScore(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= E2E_JUDGE_SCORE_MIN &&
    value <= E2E_JUDGE_SCORE_MAX
  );
}

function parseJudgeScore(
  value: unknown,
  fieldName: string,
  questionId?: string,
): number {
  if (!isValidJudgeScore(value)) {
    const suffix = questionId ? ` for question ${questionId}` : '';
    throw new EvaluationError(
      `Invalid judge ${fieldName}${suffix}: expected integer between ${E2E_JUDGE_SCORE_MIN} and ${E2E_JUDGE_SCORE_MAX}`,
      'JUDGE_RESPONSE_INVALID',
    );
  }

  return value;
}

function parseAbstentionCorrect(
  value: unknown,
  questionId?: string,
): boolean {
  if (typeof value !== 'boolean') {
    const suffix = questionId ? ` for question ${questionId}` : '';
    throw new EvaluationError(
      `Invalid judge abstentionCorrect${suffix}: expected boolean`,
      'JUDGE_RESPONSE_INVALID',
    );
  }

  return value;
}

function parseExplanation(value: unknown, questionId?: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    const suffix = questionId ? ` for question ${questionId}` : '';
    throw new EvaluationError(
      `Invalid judge explanation${suffix}: expected non-empty string`,
      'JUDGE_RESPONSE_INVALID',
    );
  }

  return value;
}

export function parseE2EJudgeRawResponse(
  value: unknown,
  questionId?: string,
): E2EJudgeRawResponse {
  if (!isRecord(value)) {
    const suffix = questionId ? ` for question ${questionId}` : '';
    throw new EvaluationError(
      `Invalid judge response${suffix}: expected JSON object`,
      'JUDGE_RESPONSE_INVALID',
    );
  }

  return {
    correctness: value.correctness,
    completeness: value.completeness,
    groundedness: value.groundedness,
    abstentionCorrect: value.abstentionCorrect,
    explanation: value.explanation,
  };
}

export function parseE2EJudgeScoreSnapshot(
  value: unknown,
  questionId?: string,
): E2EJudgeScoreSnapshot {
  const raw = parseE2EJudgeRawResponse(value, questionId);

  return {
    correctness: parseJudgeScore(raw.correctness, 'correctness', questionId),
    completeness: parseJudgeScore(raw.completeness, 'completeness', questionId),
    groundedness: parseJudgeScore(raw.groundedness, 'groundedness', questionId),
    abstentionCorrect: parseAbstentionCorrect(raw.abstentionCorrect, questionId),
    explanation: parseExplanation(raw.explanation, questionId),
  };
}

export function toE2EJudgeResult(
  questionId: string,
  snapshot: E2EJudgeScoreSnapshot,
): E2EJudgeResult {
  return {
    questionId,
    ...snapshot,
  };
}

export function parseE2EJudgeResponseJson(
  rawJson: string,
  questionId?: string,
): E2EJudgeScoreSnapshot {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch (error) {
    const suffix = questionId ? ` for question ${questionId}` : '';
    throw new EvaluationError(
      `Invalid judge response JSON${suffix}`,
      'JUDGE_RESPONSE_INVALID',
      error,
    );
  }

  return parseE2EJudgeScoreSnapshot(parsed, questionId);
}
