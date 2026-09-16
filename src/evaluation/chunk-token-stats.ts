export interface NumericSummary {
  min: number;
  mean: number;
  p50: number;
  p75: number;
  p90: number;
  p95: number;
  p99: number;
  max: number;
}

export interface BucketDefinition {
  label: string;
  min: number;
  max: number | null;
}

export interface BucketCount {
  label: string;
  count: number;
  percentage: number;
}

export interface ThresholdCount {
  threshold: number;
  count: number;
  percentage: number;
}

export const TOKEN_BUCKETS: BucketDefinition[] = [
  { label: '0-249', min: 0, max: 249 },
  { label: '250-499', min: 250, max: 499 },
  { label: '500-749', min: 500, max: 749 },
  { label: '750-999', min: 750, max: 999 },
  { label: '1000-1249', min: 1000, max: 1249 },
  { label: '1250-1499', min: 1250, max: 1499 },
  { label: '1500-1749', min: 1500, max: 1749 },
  { label: '1750-1999', min: 1750, max: 1999 },
  { label: '2000-2249', min: 2000, max: 2249 },
  { label: '2250-2499', min: 2250, max: 2499 },
  { label: '2500-2999', min: 2500, max: 2999 },
  { label: '3000+', min: 3000, max: null },
];

export const TOKEN_THRESHOLDS = [500, 750, 1000, 1250, 1500, 2000, 2500, 3000];

export function mean(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const sum = values.reduce((acc, value) => acc + value, 0);
  return Number((sum / values.length).toFixed(2));
}

export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) {
    return 0;
  }
  if (sorted.length === 1) {
    return sorted[0]!;
  }

  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) {
    return sorted[lower]!;
  }

  const weight = index - lower;
  return Number(
    (sorted[lower]! * (1 - weight) + sorted[upper]! * weight).toFixed(2),
  );
}

export function summarize(values: number[]): NumericSummary {
  if (values.length === 0) {
    return {
      min: 0,
      mean: 0,
      p50: 0,
      p75: 0,
      p90: 0,
      p95: 0,
      p99: 0,
      max: 0,
    };
  }

  const sorted = [...values].sort((a, b) => a - b);
  return {
    min: sorted[0]!,
    mean: mean(values),
    p50: percentile(sorted, 50),
    p75: percentile(sorted, 75),
    p90: percentile(sorted, 90),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    max: sorted[sorted.length - 1]!,
  };
}

export function countInBucket(value: number, bucket: BucketDefinition): boolean {
  if (bucket.max === null) {
    return value >= bucket.min;
  }
  return value >= bucket.min && value <= bucket.max;
}

export function buildBucketCounts(
  values: number[],
  buckets: BucketDefinition[] = TOKEN_BUCKETS,
): BucketCount[] {
  const total = values.length;
  return buckets.map((bucket) => {
    const count = values.filter((value) => countInBucket(value, bucket)).length;
    return {
      label: bucket.label,
      count,
      percentage: total === 0 ? 0 : Number(((count / total) * 100).toFixed(2)),
    };
  });
}

export function buildThresholdCounts(
  values: number[],
  thresholds: number[] = TOKEN_THRESHOLDS,
): ThresholdCount[] {
  const total = values.length;
  return thresholds.map((threshold) => {
    const count = values.filter((value) => value >= threshold).length;
    return {
      threshold,
      count,
      percentage: total === 0 ? 0 : Number(((count / total) * 100).toFixed(2)),
    };
  });
}

export function charsPerToken(charCount: number, tokenCount: number): number {
  if (tokenCount === 0) {
    return 0;
  }
  return Number((charCount / tokenCount).toFixed(4));
}

export function globalCharsPerToken(
  totalCharacters: number,
  totalTokens: number,
): number {
  if (totalTokens === 0) {
    return 0;
  }
  return Number((totalCharacters / totalTokens).toFixed(4));
}
