import type { CorpusContentStats, PenalCodeArticle } from './types.js';
import { OVERSIZED_ARTICLE_THRESHOLD } from './corpus-config.js';

function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
}

export function computeContentStats(
  articles: PenalCodeArticle[],
): CorpusContentStats {
  const lengths = articles.map((a) => a.content.length);
  if (lengths.length === 0) {
    return { min: 0, max: 0, avg: 0, median: 0, gt1500: 0, gt2000: 0 };
  }

  const sum = lengths.reduce((acc, len) => acc + len, 0);
  return {
    min: Math.min(...lengths),
    max: Math.max(...lengths),
    avg: Number((sum / lengths.length).toFixed(1)),
    median: median(lengths),
    gt1500: lengths.filter((len) => len > 1500).length,
    gt2000: lengths.filter((len) => len > 2000).length,
  };
}

export function annotateOversizedArticles(
  articles: PenalCodeArticle[],
  threshold: number = OVERSIZED_ARTICLE_THRESHOLD,
): number {
  let count = 0;
  for (const article of articles) {
    const len = article.content.length;
    article.metadata.contentLength = len;
    if (len >= threshold) {
      article.metadata.isOversized = true;
      count++;
    }
  }
  return count;
}
