import { EvaluationError } from './evaluation.error.js';
import { average, toPercent } from './metrics.js';

export const JUDGE_PASS_SCORE_THRESHOLD = 3;

export function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}

export function computeAverage(scores: number[]): number {
  if (scores.length === 0) {
    throw new EvaluationError(
      'Cannot compute average on an empty score set',
      'REPORT_EMPTY_DATASET',
    );
  }

  return roundToTwoDecimals(average(scores));
}

export function computePassRate(scores: number[]): number {
  if (scores.length === 0) {
    throw new EvaluationError(
      'Cannot compute pass rate on an empty score set',
      'REPORT_EMPTY_DATASET',
    );
  }

  const passedCount = scores.filter(
    (score) => score >= JUDGE_PASS_SCORE_THRESHOLD,
  ).length;

  return roundToTwoDecimals(toPercent(passedCount / scores.length));
}

export function computeAccuracy(correctCount: number, totalCount: number): number {
  if (totalCount === 0) {
    throw new EvaluationError(
      'Cannot compute accuracy on an empty dataset',
      'REPORT_EMPTY_DATASET',
    );
  }

  return roundToTwoDecimals(toPercent(correctCount / totalCount));
}
