import { describe, expect, it } from 'vitest';

import {
  areNeighborArticles,
  buildBm25Index,
  jaccardSimilarity,
  scoreBm25,
  tokenizeForLexical,
} from '../multicorpus/semantic-diagnostic-lexical.js';

describe('semantic-diagnostic-lexical', () => {
  it('computes jaccard overlap', () => {
    const value = jaccardSimilarity(
      'peine torture article 222-1',
      'soumis torture peine criminelle',
    );
    expect(value).toBeGreaterThan(0);
  });

  it('detects neighbor articles', () => {
    expect(areNeighborArticles('222-1', '222-3', true)).toBe(true);
    expect(areNeighborArticles('222-1', '223-1', true)).toBe(false);
  });

  it('ranks BM25 documents', () => {
    const index = buildBm25Index([
      { id: 'a#0', text: 'naturalisation francaise mariage' },
      { id: 'b#0', text: 'contrat travail duree' },
    ]);
    const ranked = scoreBm25(index, 'naturalisation par mariage');
    expect(ranked[0]?.id).toBe('a#0');
    expect(tokenizeForLexical('  ')).toEqual([]);
  });
});
