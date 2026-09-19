export interface GoldArticle {
  corpusId: string;
  articleNumber: string;
}

export function goldArticleKey(article: GoldArticle): string {
  return `${article.corpusId}::${article.articleNumber}`;
}

export function goldArticlesMatch(
  left: GoldArticle,
  right: GoldArticle,
): boolean {
  return (
    left.corpusId === right.corpusId &&
    left.articleNumber === right.articleNumber
  );
}

export function uniqueGoldArticles(articles: GoldArticle[]): GoldArticle[] {
  const seen = new Set<string>();
  const unique: GoldArticle[] = [];

  for (const article of articles) {
    const key = goldArticleKey(article);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(article);
  }

  return unique;
}

export function goldCorpusIdsFromArticles(articles: GoldArticle[]): string[] {
  return [...new Set(articles.map((article) => article.corpusId))].sort();
}

export function isGoldArticleInResults(
  gold: GoldArticle,
  results: GoldArticle[],
): boolean {
  return results.some((result) => goldArticlesMatch(gold, result));
}

export function extractGoldArticlesFromChunks(
  chunks: Array<{ corpusId: string; articleNumber: string }>,
): GoldArticle[] {
  return uniqueGoldArticles(
    chunks.map((chunk) => ({
      corpusId: chunk.corpusId,
      articleNumber: chunk.articleNumber,
    })),
  );
}
