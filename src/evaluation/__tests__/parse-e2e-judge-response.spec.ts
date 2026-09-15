import { describe, expect, it } from 'vitest';

import { EvaluationError } from '../evaluation.error.js';
import {
  isValidJudgeScore,
  parseE2EJudgeResponseJson,
  parseE2EJudgeScoreSnapshot,
} from '../parse-e2e-judge-response.js';

describe('isValidJudgeScore', () => {
  it('accepts 0 and 4', () => {
    expect(isValidJudgeScore(0)).toBe(true);
    expect(isValidJudgeScore(4)).toBe(true);
  });

  it('rejects -1, 5, 1.5 and strings', () => {
    expect(isValidJudgeScore(-1)).toBe(false);
    expect(isValidJudgeScore(5)).toBe(false);
    expect(isValidJudgeScore(1.5)).toBe(false);
    expect(isValidJudgeScore('3')).toBe(false);
  });
});

describe('parseE2EJudgeScoreSnapshot', () => {
  it('parses a valid judge response', () => {
    const snapshot = parseE2EJudgeScoreSnapshot(
      {
        correctness: 4,
        completeness: 3,
        groundedness: 4,
        abstentionCorrect: true,
        explanation: 'Réponse correcte et bien fondée.',
      },
      'q001',
    );

    expect(snapshot).toEqual({
      correctness: 4,
      completeness: 3,
      groundedness: 4,
      abstentionCorrect: true,
      explanation: 'Réponse correcte et bien fondée.',
    });
  });

  it('rejects invalid JSON payloads', () => {
    expect(() => parseE2EJudgeResponseJson('{ invalid json }', 'q001')).toThrow(
      EvaluationError,
    );
    expect(() => parseE2EJudgeResponseJson('{ invalid json }', 'q001')).toThrow(
      /Invalid judge response JSON/,
    );
  });

  it('rejects missing fields', () => {
    expect(() =>
      parseE2EJudgeScoreSnapshot(
        {
          correctness: 4,
          completeness: 4,
          groundedness: 4,
        },
        'q001',
      ),
    ).toThrow(EvaluationError);
  });

  it('rejects wrong types and out-of-range scores', () => {
    expect(() =>
      parseE2EJudgeScoreSnapshot(
        {
          correctness: '4',
          completeness: 4,
          groundedness: 4,
          abstentionCorrect: true,
          explanation: 'ok',
        },
        'q001',
      ),
    ).toThrow(/correctness/);

    expect(() =>
      parseE2EJudgeScoreSnapshot(
        {
          correctness: 5,
          completeness: 4,
          groundedness: 4,
          abstentionCorrect: true,
          explanation: 'ok',
        },
        'q001',
      ),
    ).toThrow(/correctness/);

    expect(() =>
      parseE2EJudgeScoreSnapshot(
        {
          correctness: 4,
          completeness: 4,
          groundedness: 4,
          abstentionCorrect: 'true',
          explanation: 'ok',
        },
        'q001',
      ),
    ).toThrow(/abstentionCorrect/);
  });
});

describe('abstention parsing scenarios', () => {
  it('accepts expectedAbstention=true with abstentionCorrect=true', () => {
    const snapshot = parseE2EJudgeScoreSnapshot({
      correctness: 0,
      completeness: 0,
      groundedness: 4,
      abstentionCorrect: true,
      explanation: 'Abstention correcte.',
    });

    expect(snapshot.abstentionCorrect).toBe(true);
  });

  it('accepts expectedAbstention=false with abstentionCorrect=false', () => {
    const snapshot = parseE2EJudgeScoreSnapshot({
      correctness: 2,
      completeness: 2,
      groundedness: 3,
      abstentionCorrect: false,
      explanation: 'Le modèle s’est abstenu à tort.',
    });

    expect(snapshot.abstentionCorrect).toBe(false);
  });
});
