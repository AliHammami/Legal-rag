import { describe, expect, it } from 'vitest';

import { EvaluationError } from '../evaluation.error.js';
import {
  isValidSourceJudgeScore,
  parseE2ESourceJudgeResponseJson,
  parseE2ESourceJudgeResult,
} from '../parse-e2e-source-judge-response.js';

describe('isValidSourceJudgeScore', () => {
  it('accepts 0 and 4', () => {
    expect(isValidSourceJudgeScore(0)).toBe(true);
    expect(isValidSourceJudgeScore(4)).toBe(true);
  });

  it('rejects invalid values', () => {
    expect(isValidSourceJudgeScore(-1)).toBe(false);
    expect(isValidSourceJudgeScore(5)).toBe(false);
    expect(isValidSourceJudgeScore(1.5)).toBe(false);
    expect(isValidSourceJudgeScore('3')).toBe(false);
  });
});

describe('parseE2ESourceJudgeResult', () => {
  it('parses a valid source judge response', () => {
    expect(
      parseE2ESourceJudgeResult(
        {
          sourceRelevance: 4,
          sourceCoverage: 3,
          explanation: 'Sources pertinentes.',
        },
        'q001',
      ),
    ).toEqual({
      sourceRelevance: 4,
      sourceCoverage: 3,
      explanation: 'Sources pertinentes.',
    });
  });

  it('rejects invalid JSON and missing fields', () => {
    expect(() => parseE2ESourceJudgeResponseJson('{ invalid }', 'q001')).toThrow(
      EvaluationError,
    );

    expect(() =>
      parseE2ESourceJudgeResult(
        {
          sourceRelevance: 4,
          explanation: 'missing coverage',
        },
        'q001',
      ),
    ).toThrow(EvaluationError);
  });
});
