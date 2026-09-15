import { describe, expect, it } from 'vitest';

import { EvaluationError } from '../evaluation.error.js';
import { buildScoreDistribution } from '../score-distribution.js';

describe('buildScoreDistribution', () => {
  it('builds a distribution for mixed scores', () => {
    expect(buildScoreDistribution([4, 4, 3, 2, 0])).toEqual({
      '0': 1,
      '1': 0,
      '2': 1,
      '3': 1,
      '4': 2,
    });
  });

  it('returns an empty distribution for an empty input', () => {
    expect(buildScoreDistribution([])).toEqual({
      '0': 0,
      '1': 0,
      '2': 0,
      '3': 0,
      '4': 0,
    });
  });

  it('rejects invalid scores', () => {
    expect(() => buildScoreDistribution([4, 5])).toThrow(EvaluationError);
  });
});
