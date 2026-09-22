import {
  goldArticlesMatch,
  type GoldArticle,
} from '../gold-article.js';
import {
  firstRankForGold,
  fullQuestionCoverageAtK,
  goldCorpusCoverageAtK,
  goldRecallAtK,
  type RankedRetrievalChunk,
} from './retrieval-depth-benchmark.js';

export interface VariantGoldContribution {
  vectorOnly: GoldArticle[];
  bm25Only: GoldArticle[];
  both: GoldArticle[];
}

export function goldHitsInList(
  goldArticles: GoldArticle[],
  chunks: RankedRetrievalChunk[],
): GoldArticle[] {
  return goldArticles.filter(
    (gold) => firstRankForGold(gold, chunks) !== null,
  );
}

export function computeGoldContribution(
  goldArticles: GoldArticle[],
  vectorChunks: RankedRetrievalChunk[],
  bm25Chunks: RankedRetrievalChunk[],
): VariantGoldContribution {
  const vectorHits = new Set(
    goldHitsInList(goldArticles, vectorChunks).map(
      (gold) => `${gold.corpusId}:${gold.articleNumber}`,
    ),
  );
  const bm25Hits = new Set(
    goldHitsInList(goldArticles, bm25Chunks).map(
      (gold) => `${gold.corpusId}:${gold.articleNumber}`,
    ),
  );

  const vectorOnly: GoldArticle[] = [];
  const bm25Only: GoldArticle[] = [];
  const both: GoldArticle[] = [];

  for (const gold of goldArticles) {
    const key = `${gold.corpusId}:${gold.articleNumber}`;
    const inVector = vectorHits.has(key);
    const inBm25 = bm25Hits.has(key);
    if (inVector && inBm25) {
      both.push(gold);
    } else if (inVector) {
      vectorOnly.push(gold);
    } else if (inBm25) {
      bm25Only.push(gold);
    }
  }

  return { vectorOnly, bm25Only, both };
}

export function goldRecallInCandidateSet(
  goldArticles: GoldArticle[],
  chunks: RankedRetrievalChunk[],
): { recall: number; hits: number; total: number } {
  const hits = goldArticles.filter(
    (gold) => chunks.some((chunk) => goldArticlesMatch(gold, chunk)),
  ).length;
  const total = goldArticles.length;
  return {
    recall: total === 0 ? 0 : hits / total,
    hits,
    total,
  };
}

export function summarizeVariantAt50(input: {
  results: Array<{
    questionType: string;
    goldArticles: GoldArticle[];
    goldCorpusIds: string[];
    chunks: RankedRetrievalChunk[];
    useFullListForRecall?: boolean;
  }>;
}): {
  goldRecall: number;
  goldHits: number;
  goldTotal: number;
  fullCoverageRate: number;
  fullCoverageCount: number;
  corpusCoverageRate: number;
} {
  let goldHits = 0;
  let goldTotal = 0;
  let fullCoverage = 0;
  let corpusCovered = 0;
  let corpusTotal = 0;

  for (const result of input.results) {
    const recall = result.useFullListForRecall
      ? goldRecallInCandidateSet(result.goldArticles, result.chunks)
      : goldRecallAtK(result.goldArticles, result.chunks, 50);
    goldHits += recall.hits;
    goldTotal += recall.total;

    const covered = result.useFullListForRecall
      ? result.goldArticles.every((gold) =>
          result.chunks.some((chunk) => goldArticlesMatch(gold, chunk)),
        )
      : fullQuestionCoverageAtK(result.goldArticles, result.chunks, 50);
    if (covered) {
      fullCoverage += 1;
    }

    if (result.questionType === 'multi-corpus') {
      if (result.useFullListForRecall) {
        const corporaWithHit = new Set(
          result.goldArticles
            .filter((gold) =>
              result.chunks.some((chunk) => goldArticlesMatch(gold, chunk)),
            )
            .map((gold) => gold.corpusId),
        );
        corpusCovered += result.goldCorpusIds.filter((corpusId) =>
          corporaWithHit.has(corpusId),
        ).length;
        corpusTotal += result.goldCorpusIds.length;
      } else {
        const corpus = goldCorpusCoverageAtK(
          result.goldCorpusIds,
          result.goldArticles,
          result.chunks,
          50,
        );
        corpusCovered += corpus.covered;
        corpusTotal += corpus.total;
      }
    }
  }

  return {
    goldRecall: goldTotal === 0 ? 0 : goldHits / goldTotal,
    goldHits,
    goldTotal,
    fullCoverageRate:
      input.results.length === 0 ? 0 : fullCoverage / input.results.length,
    fullCoverageCount: fullCoverage,
    corpusCoverageRate:
      corpusTotal === 0 ? 0 : corpusCovered / corpusTotal,
  };
}

export function candidateCountStats(values: number[]): {
  mean: number;
  min: number;
  max: number;
  median: number;
} {
  if (values.length === 0) {
    return { mean: 0, min: 0, max: 0, median: 0 };
  }
  const sorted = [...values].sort((left, right) => left - right);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0
      ? (sorted[mid - 1]! + sorted[mid]!) / 2
      : sorted[mid]!;
  return {
    mean: values.reduce((sum, value) => sum + value, 0) / values.length,
    min: sorted[0]!,
    max: sorted[sorted.length - 1]!,
    median,
  };
}

export function rankMapForGold(
  goldArticles: GoldArticle[],
  chunks: RankedRetrievalChunk[],
): Record<string, number | null> {
  const map: Record<string, number | null> = {};
  for (const gold of goldArticles) {
    map[`${gold.corpusId}:${gold.articleNumber}`] = firstRankForGold(
      gold,
      chunks,
    );
  }
  return map;
}
