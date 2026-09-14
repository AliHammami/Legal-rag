export function dedupeArticleNumbers(articleNumbers: string[]): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];

  for (const articleNumber of articleNumbers) {
    if (seen.has(articleNumber)) {
      continue;
    }
    seen.add(articleNumber);
    deduped.push(articleNumber);
  }

  return deduped;
}

export function recallAtK(
  goldArticles: string[],
  resultArticles: string[],
  k: number,
): 0 | 1 {
  if (k < 1) {
    return 0;
  }

  const goldSet = new Set(goldArticles);
  const topK = resultArticles.slice(0, k);
  return topK.some((articleNumber) => goldSet.has(articleNumber)) ? 1 : 0;
}

export function mrr(goldArticles: string[], resultArticles: string[]): number {
  const dedupedResults = dedupeArticleNumbers(resultArticles);
  const goldSet = new Set(goldArticles);

  for (const [index, articleNumber] of dedupedResults.entries()) {
    if (goldSet.has(articleNumber)) {
      return 1 / (index + 1);
    }
  }

  return 0;
}

export function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function toPercent(ratio: number): number {
  return ratio * 100;
}
