import { describe, expect, it } from 'vitest';

import {
  corpusPrecisionRecallF1,
  mrrGoldArticles,
  recallAtKGoldArticles,
} from '../multicorpus/metrics.js';

describe('multicorpus metrics', () => {
  it('computes exact corpus match regardless of order', () => {
    const result = corpusPrecisionRecallF1(
      ['code-penal', 'code-civil'],
      ['code-civil', 'code-penal'],
    );
    expect(result.exactMatch).toBe(true);
    expect(result.f1).toBe(1);
  });

  it('computes partial corpus recall/precision', () => {
    const result = corpusPrecisionRecallF1(
      ['code-penal', 'code-civil'],
      ['code-penal'],
    );
    expect(result.exactMatch).toBe(false);
    expect(result.recall).toBe(0.5);
    expect(result.precision).toBe(1);
  });

  it('computes fractional recall@K on corpus+article pairs', () => {
    const gold = [
      { corpusId: 'code-penal', articleNumber: '122-5' },
      { corpusId: 'code-civil', articleNumber: '1240' },
    ];
    const retrieved = [
      { corpusId: 'code-penal', articleNumber: '122-5' },
      { corpusId: 'code-civil', articleNumber: '999' },
    ];

    expect(recallAtKGoldArticles(gold, retrieved, 5)).toBe(0.5);
    expect(mrrGoldArticles(gold, retrieved)).toBe(1);
  });

  it('does not match article number without corpusId', () => {
    const gold = [{ corpusId: 'code-penal', articleNumber: '9' }];
    const retrieved = [{ corpusId: 'code-civil', articleNumber: '9' }];
    expect(recallAtKGoldArticles(gold, retrieved, 5)).toBe(0);
  });
});
