import { describe, expect, it } from 'vitest';
import {
  buildBucketCounts,
  buildThresholdCounts,
  charsPerToken,
  globalCharsPerToken,
  mean,
  percentile,
  summarize,
  TOKEN_BUCKETS,
} from '../chunk-token-stats.js';

describe('chunk-token-stats', () => {
  it('calcule la moyenne', () => {
    expect(mean([10, 20, 30])).toBe(20);
  });

  it('calcule la m?diane / P50', () => {
    expect(percentile([1, 2, 3, 4, 5], 50)).toBe(3);
    expect(percentile([1, 2, 3, 4], 50)).toBe(2.5);
  });

  it('calcule les percentiles P95 et P99', () => {
    const values = Array.from({ length: 101 }, (_, index) => index);
    expect(percentile(values, 95)).toBe(95);
    expect(percentile(values, 99)).toBe(99);
  });

  it('r?sume un jeu de valeurs', () => {
    const summary = summarize([100, 200, 300, 400, 500]);
    expect(summary.min).toBe(100);
    expect(summary.max).toBe(500);
    expect(summary.mean).toBe(300);
    expect(summary.p50).toBe(300);
  });

  it('r?partit les tokens dans les buckets', () => {
    const buckets = buildBucketCounts([100, 600, 1300, 3100], TOKEN_BUCKETS);
    expect(buckets.find((bucket) => bucket.label === '0-249')?.count).toBe(1);
    expect(buckets.find((bucket) => bucket.label === '500-749')?.count).toBe(1);
    expect(buckets.find((bucket) => bucket.label === '1250-1499')?.count).toBe(
      1,
    );
    expect(buckets.find((bucket) => bucket.label === '3000+')?.count).toBe(1);
  });

  it('compte les seuils tokeniques', () => {
    const thresholds = buildThresholdCounts([400, 900, 1200, 2100]);
    expect(thresholds.find((entry) => entry.threshold === 1000)?.count).toBe(2);
    expect(thresholds.find((entry) => entry.threshold === 2000)?.count).toBe(1);
  });

  it('calcule le ratio caract?res/token', () => {
    expect(charsPerToken(2000, 500)).toBe(4);
    expect(globalCharsPerToken(8000, 2000)).toBe(4);
  });
});
