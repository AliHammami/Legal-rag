import { describe, expect, it } from 'vitest';
import { dedupeArticleNumbers, mrr, recallAtK } from '../metrics.js';

describe('dedupeArticleNumbers', () => {
  it('removes duplicate articles while preserving order', () => {
    expect(
      dedupeArticleNumbers(['122-5', '122-5', '462-9', '122-5']),
    ).toEqual(['122-5', '462-9']);
  });
});

describe('recallAtK', () => {
  it('returns 1 when a gold article appears in top K', () => {
    expect(recallAtK(['122-5', '122-6'], ['462-9', '122-6', '221-1'], 3)).toBe(
      1,
    );
  });

  it('returns 0 when no gold article appears in top K', () => {
    expect(recallAtK(['122-5'], ['122-6', '122-7'], 2)).toBe(0);
  });

  it('returns 1 when gold is present in top 5 but not necessarily ranked first', () => {
    expect(recallAtK(['121-5'], ['462-9', '221-1', '121-5', '122-5', '122-6'], 5)).toBe(
      1,
    );
  });

  it('returns 0 for empty results', () => {
    expect(recallAtK(['122-5'], [], 5)).toBe(0);
  });
});

describe('mrr', () => {
  it('returns 1 when the first deduped result is relevant', () => {
    expect(mrr(['122-5'], ['122-5', '462-9'])).toBe(1);
  });

  it('returns 0.5 when the first relevant article is second after dedupe', () => {
    expect(mrr(['122-5'], ['462-9', '122-5'])).toBe(0.5);
  });

  it('returns 0.333 when the first relevant article is third after dedupe', () => {
    expect(mrr(['122-5'], ['462-9', '221-1', '122-5'])).toBeCloseTo(0.333, 3);
  });

  it('returns 0 when no relevant article is present', () => {
    expect(mrr(['122-5'], ['122-6', '122-7'])).toBe(0);
  });

  it('does not let duplicate articles artificially improve MRR', () => {
    expect(mrr(['122-5'], ['462-9', '122-5', '122-5'])).toBe(0.5);
    expect(mrr(['462-9'], ['122-5', '122-5', '462-9'])).toBeCloseTo(0.5, 5);
  });

  it('handles multiple gold articles using the first relevant hit', () => {
    expect(mrr(['122-5', '122-6'], ['462-9', '122-6', '122-5'])).toBe(0.5);
  });
});
