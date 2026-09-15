import { describe, expect, it } from 'vitest';

import { EvaluationError } from '../evaluation.error.js';
import {
  computeAccuracy,
  computeAverage,
  computePassRate,
  roundToTwoDecimals,
} from '../report-metrics.js';

describe('roundToTwoDecimals', () => {
  it('rounds to two decimal places', () => {
    expect(roundToTwoDecimals(3.856)).toBe(3.86);
    expect(roundToTwoDecimals(3.854)).toBe(3.85);
  });
});

describe('computeAverage', () => {
  it('computes a rounded average', () => {
    expect(computeAverage([4, 3, 4, 3])).toBe(3.5);
  });

  it('fails explicitly on empty input', () => {
    expect(() => computeAverage([])).toThrow(EvaluationError);
  });
});

describe('computePassRate', () => {
  it('counts scores >= 3 as pass', () => {
    expect(computePassRate([4, 3, 2, 4])).toBe(75);
  });

  it('fails explicitly on empty input', () => {
    expect(() => computePassRate([])).toThrow(EvaluationError);
  });
});

describe('computeAccuracy', () => {
  it('computes abstention accuracy percentages', () => {
    expect(computeAccuracy(5, 5)).toBe(100);
    expect(computeAccuracy(4, 5)).toBe(80);
    expect(computeAccuracy(0, 5)).toBe(0);
  });

  it('fails explicitly on empty input', () => {
    expect(() => computeAccuracy(0, 0)).toThrow(EvaluationError);
  });
});
