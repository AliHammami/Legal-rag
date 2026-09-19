import type { GoldArticle } from '../gold-article.js';
import { goldArticleKey, goldArticlesMatch } from '../gold-article.js';
import { average } from '../metrics.js';
import type { RetrievalMetricsSnapshot } from './types.js';

export function corpusSet(values: string[]): Set<string> {
  return new Set(values);
}

export function setsEqual(left: Set<string>, right: Set<string>): boolean {
  if (left.size !== right.size) {
    return false;
  }
  for (const value of left) {
    if (!right.has(value)) {
      return false;
    }
  }
  return true;
}

export function corpusPrecisionRecallF1(
  goldCorpusIds: string[],
  predictedCorpusIds: string[],
): { precision: number; recall: number; f1: number; exactMatch: boolean } {
  const gold = corpusSet(goldCorpusIds);
  const predicted = corpusSet(predictedCorpusIds);
  const exactMatch = setsEqual(gold, predicted);

  if (gold.size === 0 && predicted.size === 0) {
    return { precision: 1, recall: 1, f1: 1, exactMatch: true };
  }

  if (gold.size === 0 || predicted.size === 0) {
    return { precision: 0, recall: 0, f1: 0, exactMatch: false };
  }

  let intersection = 0;
  for (const corpusId of predicted) {
    if (gold.has(corpusId)) {
      intersection += 1;
    }
  }

  const precision = intersection / predicted.size;
  const recall = intersection / gold.size;
  const f1 =
    precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);

  return { precision, recall, f1, exactMatch };
}

/**
 * Fractional recall@K for multi-gold questions:
 * hits = gold articles found in top-K; recall = hits / |gold|
 */
export function recallAtKGoldArticles(
  goldArticles: GoldArticle[],
  retrievedArticles: GoldArticle[],
  k: number,
): number {
  if (goldArticles.length === 0) {
    return 0;
  }

  const topK = retrievedArticles.slice(0, k);
  let hits = 0;
  for (const gold of goldArticles) {
    if (topK.some((result) => goldArticlesMatch(gold, result))) {
      hits += 1;
    }
  }

  return hits / goldArticles.length;
}

export function mrrGoldArticles(
  goldArticles: GoldArticle[],
  retrievedArticles: GoldArticle[],
): number {
  if (goldArticles.length === 0) {
    return 0;
  }

  const seen = new Set<string>();
  for (const [index, result] of retrievedArticles.entries()) {
    const key = goldArticleKey(result);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    if (goldArticles.some((gold) => goldArticlesMatch(gold, result))) {
      return 1 / (index + 1);
    }
  }

  return 0;
}

export function buildRetrievalMetricsSnapshot(
  goldArticles: GoldArticle[],
  retrievedArticles: GoldArticle[],
): RetrievalMetricsSnapshot {
  return {
    recallAt5: recallAtKGoldArticles(goldArticles, retrievedArticles, 5),
    recallAt10: recallAtKGoldArticles(goldArticles, retrievedArticles, 10),
    recallAt20: recallAtKGoldArticles(goldArticles, retrievedArticles, 20),
    mrr: mrrGoldArticles(goldArticles, retrievedArticles),
  };
}

export function averageRetrievalMetrics(
  snapshots: RetrievalMetricsSnapshot[],
): RetrievalMetricsSnapshot {
  return {
    recallAt5: average(snapshots.map((snapshot) => snapshot.recallAt5)),
    recallAt10: average(snapshots.map((snapshot) => snapshot.recallAt10)),
    recallAt20: average(snapshots.map((snapshot) => snapshot.recallAt20)),
    mrr: average(snapshots.map((snapshot) => snapshot.mrr)),
  };
}

export function percentile(values: number[], p: number): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1),
  );
  return sorted[index] ?? 0;
}

export function latencyStats(values: number[]): {
  average: number;
  p50: number;
  p95: number;
} {
  return {
    average: average(values),
    p50: percentile(values, 50),
    p95: percentile(values, 95),
  };
}
