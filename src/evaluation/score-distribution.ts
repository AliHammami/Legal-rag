import { EvaluationError } from './evaluation.error.js';
import type { ScoreDistribution } from './e2e-report.types.js';
import { isValidJudgeScore } from './parse-e2e-judge-response.js';

export function createEmptyScoreDistribution(): ScoreDistribution {
  return {
    '0': 0,
    '1': 0,
    '2': 0,
    '3': 0,
    '4': 0,
  };
}

export function buildScoreDistribution(scores: number[]): ScoreDistribution {
  const distribution = createEmptyScoreDistribution();

  for (const score of scores) {
    if (!isValidJudgeScore(score)) {
      throw new EvaluationError(
        `Invalid score for distribution: expected integer between 0 and 4, got ${String(score)}`,
        'REPORT_INVALID_SCORE',
      );
    }

    const key = String(score) as keyof ScoreDistribution;
    distribution[key] += 1;
  }

  return distribution;
}
