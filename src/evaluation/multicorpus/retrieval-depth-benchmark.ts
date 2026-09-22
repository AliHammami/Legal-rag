import {
  computePerCorpusQuota,
  mergeCorpusQuotaCandidates,
} from '../../retrieval/corpus-quota-retrieval.js';
import {
  goldArticlesMatch,
  type GoldArticle,
} from '../gold-article.js';
import type { SimilarChunk } from '../../retrieval/types.js';

export const RETRIEVAL_DEPTH_K_VALUES = [20, 30, 40, 50] as const;

export type RetrievalDepthK = (typeof RETRIEVAL_DEPTH_K_VALUES)[number];

export type RetrievalDepthStrategy = 'quota' | 'global';

export type GoldDepthBucket =
  | 'present_at_20'
  | 'P20_30'
  | 'P30_40'
  | 'P40_50'
  | 'P50_plus'
  | 'not_observed_beyond_20';

export interface RankedRetrievalChunk {
  corpusId: string;
  articleNumber: string;
  chunkId: string;
  rank: number;
  distance?: number;
}

export interface GoldArticleDepthResult {
  gold: GoldArticle;
  ranksByObservedMaxK: Partial<Record<RetrievalDepthK, number | null>>;
  firstRank: number | null;
  bucket: GoldDepthBucket;
}

export interface RetrievalDepthQuestionResult {
  questionId: string;
  questionType: 'single-corpus' | 'multi-corpus' | string;
  routedCorpusIds: string[];
  goldArticles: GoldArticle[];
  strategy: RetrievalDepthStrategy;
  dataSource: 'quota-audit-top20' | 'local-vector-replay';
  observedMaxK: RetrievalDepthK;
  metricsByK: Record<
    RetrievalDepthK,
    {
      goldRecall: number;
      goldHits: number;
      goldTotal: number;
      fullQuestionCoverage: boolean;
      goldCorpusCoverage: number;
      goldCorpusTotal: number;
    }
  >;
  goldDepth: GoldArticleDepthResult[];
  patterns: string[];
}

export interface RetrievalDepthAggregateRow {
  k: RetrievalDepthK;
  goldRecall: number;
  goldHits: number;
  goldTotal: number;
  fullQuestionCoverageRate: number;
  fullQuestionCoverageCount: number;
  questionCount: number;
  goldAbsentCount: number;
  goldCorpusCoverageRate: number;
}

export interface MarginalGainRow {
  fromK: RetrievalDepthK;
  toK: RetrievalDepthK;
  recallDeltaPctPoints: number;
  fullCoverageDeltaPctPoints: number;
}

export interface DepthBucketSummary {
  presentAt20: number;
  P20_30: number;
  P30_40: number;
  P40_50: number;
  P50_plus: number;
  notObservedBeyond20: number;
}

function toSimilarChunk(chunk: RankedRetrievalChunk): SimilarChunk {
  return {
    corpusId: chunk.corpusId,
    chunkId: chunk.chunkId,
    articleNumber: chunk.articleNumber,
    content: '',
    distance: chunk.distance ?? chunk.rank,
    metadata: {
      articleNumber: chunk.articleNumber,
      pageStart: 0,
      pageEnd: 0,
      source: '',
      sourceType: 'pdf',
      chunkIndex: 0,
      chunkCount: 1,
      unitStart: 0,
      unitEnd: 0,
      unitCount: 1,
    },
  };
}

export function rankRetrievalChunks(
  chunks: Array<{
    corpusId: string;
    articleNumber: string;
    chunkId: string;
    distance?: number;
    retrievalRank?: number;
  }>,
): RankedRetrievalChunk[] {
  const sorted = [...chunks].sort((left, right) => {
    const leftRank = left.retrievalRank ?? Number.MAX_SAFE_INTEGER;
    const rightRank = right.retrievalRank ?? Number.MAX_SAFE_INTEGER;
    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }
    return (left.distance ?? 0) - (right.distance ?? 0);
  });

  return sorted.map((chunk, index) => ({
    corpusId: chunk.corpusId,
    articleNumber: chunk.articleNumber,
    chunkId: chunk.chunkId,
    rank: chunk.retrievalRank ?? index + 1,
    distance: chunk.distance,
  }));
}

export function sliceRankedChunksAtK(
  chunks: RankedRetrievalChunk[],
  k: number,
): RankedRetrievalChunk[] {
  return chunks
    .filter((chunk) => chunk.rank <= k)
    .slice(0, k);
}

export function buildQuotaRetrievalAtK(
  perCorpusSorted: Map<string, RankedRetrievalChunk[]>,
  routedCorpusIds: string[],
  globalK: number,
): RankedRetrievalChunk[] {
  if (routedCorpusIds.length <= 1) {
    const onlyCorpus = routedCorpusIds[0];
    const chunks = onlyCorpus ? perCorpusSorted.get(onlyCorpus) ?? [] : [];
    return chunks.slice(0, globalK).map((chunk, index) => ({
      ...chunk,
      rank: index + 1,
    }));
  }

  const perCorpusTopK = computePerCorpusQuota(globalK, routedCorpusIds.length);
  const merged: SimilarChunk[] = [];

  for (const corpusId of routedCorpusIds) {
    const corpusChunks = (perCorpusSorted.get(corpusId) ?? []).slice(
      0,
      perCorpusTopK,
    );
    merged.push(...corpusChunks.map(toSimilarChunk));
  }

  const capped = mergeCorpusQuotaCandidates(merged, globalK);
  return capped.map((chunk, index) => ({
    corpusId: chunk.corpusId,
    articleNumber: chunk.articleNumber,
    chunkId: chunk.chunkId,
    rank: index + 1,
    distance: chunk.distance,
  }));
}

export function buildGlobalRetrievalAtK(
  globalSorted: RankedRetrievalChunk[],
  globalK: number,
): RankedRetrievalChunk[] {
  return globalSorted.slice(0, globalK).map((chunk, index) => ({
    ...chunk,
    rank: index + 1,
  }));
}

export function firstRankForGold(
  gold: GoldArticle,
  chunks: RankedRetrievalChunk[],
): number | null {
  for (const chunk of chunks) {
    if (goldArticlesMatch(gold, chunk)) {
      return chunk.rank;
    }
  }
  return null;
}

export function goldRecallAtK(
  goldArticles: GoldArticle[],
  chunks: RankedRetrievalChunk[],
  k: number,
): { recall: number; hits: number; total: number } {
  const atK = sliceRankedChunksAtK(chunks, k);
  const hits = goldArticles.filter(
    (gold) => firstRankForGold(gold, atK) !== null,
  ).length;
  const total = goldArticles.length;
  return {
    recall: total === 0 ? 0 : hits / total,
    hits,
    total,
  };
}

export function fullQuestionCoverageAtK(
  goldArticles: GoldArticle[],
  chunks: RankedRetrievalChunk[],
  k: number,
): boolean {
  const atK = sliceRankedChunksAtK(chunks, k);
  return goldArticles.every((gold) => firstRankForGold(gold, atK) !== null);
}

export function goldCorpusCoverageAtK(
  goldCorpusIds: string[],
  goldArticles: GoldArticle[],
  chunks: RankedRetrievalChunk[],
  k: number,
): { covered: number; total: number } {
  const atK = sliceRankedChunksAtK(chunks, k);
  const corporaWithGoldHit = new Set(
    goldArticles
      .filter((gold) => firstRankForGold(gold, atK) !== null)
      .map((gold) => gold.corpusId),
  );
  return {
    covered: goldCorpusIds.filter((corpusId) => corporaWithGoldHit.has(corpusId))
      .length,
    total: goldCorpusIds.length,
  };
}

export function classifyGoldDepthBucket(input: {
  ranksByK: Partial<Record<RetrievalDepthK, number | null>>;
  observedMaxK: RetrievalDepthK;
}): GoldDepthBucket {
  const rank20 = input.ranksByK[20];
  if (rank20 !== null && rank20 !== undefined) {
    return 'present_at_20';
  }

  if (input.observedMaxK === 20) {
    return 'not_observed_beyond_20';
  }

  const rank30 = input.ranksByK[30];
  const rank40 = input.ranksByK[40];
  const rank50 = input.ranksByK[50];

  if (rank30 !== null && rank30 !== undefined) {
    return 'P20_30';
  }
  if (rank40 !== null && rank40 !== undefined) {
    return 'P30_40';
  }
  if (rank50 !== null && rank50 !== undefined) {
    return 'P40_50';
  }

  return 'P50_plus';
}

export function analyzeGoldDepth(
  goldArticles: GoldArticle[],
  chunksByObservedMaxK: RankedRetrievalChunk[],
  observedMaxK: RetrievalDepthK,
): GoldArticleDepthResult[] {
  return goldArticles.map((gold) => {
    const ranksByObservedMaxK: Partial<Record<RetrievalDepthK, number | null>> =
      {};
    for (const k of RETRIEVAL_DEPTH_K_VALUES) {
      if (k > observedMaxK) {
        continue;
      }
      ranksByObservedMaxK[k] = firstRankForGold(
        gold,
        sliceRankedChunksAtK(chunksByObservedMaxK, k),
      );
    }

    const firstRank =
      ranksByObservedMaxK[observedMaxK] ??
      firstRankForGold(gold, chunksByObservedMaxK);

    return {
      gold,
      ranksByObservedMaxK,
      firstRank,
      bucket: classifyGoldDepthBucket({
        ranksByK: ranksByObservedMaxK,
        observedMaxK,
      }),
    };
  });
}

export function aggregateRetrievalDepth(
  results: RetrievalDepthQuestionResult[],
  k: RetrievalDepthK,
): RetrievalDepthAggregateRow {
  let goldHits = 0;
  let goldTotal = 0;
  let fullCoverage = 0;
  let corpusCovered = 0;
  let corpusTotal = 0;

  for (const result of results) {
    const metrics = result.metricsByK[k];
    goldHits += metrics.goldHits;
    goldTotal += metrics.goldTotal;
    if (metrics.fullQuestionCoverage) {
      fullCoverage += 1;
    }
    corpusCovered += metrics.goldCorpusCoverage;
    corpusTotal += metrics.goldCorpusTotal;
  }

  return {
    k,
    goldRecall: goldTotal === 0 ? 0 : goldHits / goldTotal,
    goldHits,
    goldTotal,
    fullQuestionCoverageRate:
      results.length === 0 ? 0 : fullCoverage / results.length,
    fullQuestionCoverageCount: fullCoverage,
    questionCount: results.length,
    goldAbsentCount: goldTotal - goldHits,
    goldCorpusCoverageRate:
      corpusTotal === 0 ? 0 : corpusCovered / corpusTotal,
  };
}

export function computeMarginalGains(
  rows: RetrievalDepthAggregateRow[],
): MarginalGainRow[] {
  const byK = new Map(rows.map((row) => [row.k, row]));
  const pairs: Array<[RetrievalDepthK, RetrievalDepthK]> = [
    [20, 30],
    [30, 40],
    [40, 50],
  ];

  return pairs.map(([fromK, toK]) => {
    const fromRow = byK.get(fromK)!;
    const toRow = byK.get(toK)!;
    return {
      fromK,
      toK,
      recallDeltaPctPoints: (toRow.goldRecall - fromRow.goldRecall) * 100,
      fullCoverageDeltaPctPoints:
        (toRow.fullQuestionCoverageRate - fromRow.fullQuestionCoverageRate) *
        100,
    };
  });
}

export function summarizeDepthBuckets(
  depthResults: GoldArticleDepthResult[],
): DepthBucketSummary {
  const summary: DepthBucketSummary = {
    presentAt20: 0,
    P20_30: 0,
    P30_40: 0,
    P40_50: 0,
    P50_plus: 0,
    notObservedBeyond20: 0,
  };

  for (const result of depthResults) {
    switch (result.bucket) {
      case 'present_at_20':
        summary.presentAt20 += 1;
        break;
      case 'P20_30':
        summary.P20_30 += 1;
        break;
      case 'P30_40':
        summary.P30_40 += 1;
        break;
      case 'P40_50':
        summary.P40_50 += 1;
        break;
      case 'P50_plus':
        summary.P50_plus += 1;
        break;
      case 'not_observed_beyond_20':
        summary.notObservedBeyond20 += 1;
        break;
      default:
        break;
    }
  }

  return summary;
}

export function buildQuestionRetrievalDepthResult(input: {
  questionId: string;
  questionType: string;
  routedCorpusIds: string[];
  goldArticles: GoldArticle[];
  strategy: RetrievalDepthStrategy;
  dataSource: RetrievalDepthQuestionResult['dataSource'];
  rankedChunks: RankedRetrievalChunk[];
  observedMaxK: RetrievalDepthK;
}): RetrievalDepthQuestionResult {
  const goldCorpusIds = [
    ...new Set(input.goldArticles.map((article) => article.corpusId)),
  ].sort();

  const metricsByK = {} as RetrievalDepthQuestionResult['metricsByK'];
  for (const k of RETRIEVAL_DEPTH_K_VALUES) {
    if (k > input.observedMaxK) {
      continue;
    }
    const recall = goldRecallAtK(input.goldArticles, input.rankedChunks, k);
    const corpus = goldCorpusCoverageAtK(
      goldCorpusIds,
      input.goldArticles,
      input.rankedChunks,
      k,
    );
    metricsByK[k] = {
      goldRecall: recall.recall,
      goldHits: recall.hits,
      goldTotal: recall.total,
      fullQuestionCoverage: fullQuestionCoverageAtK(
        input.goldArticles,
        input.rankedChunks,
        k,
      ),
      goldCorpusCoverage: corpus.covered,
      goldCorpusTotal: corpus.total,
    };
  }

  const goldDepth = analyzeGoldDepth(
    input.goldArticles,
    input.rankedChunks,
    input.observedMaxK,
  );

  const patterns: string[] = [];
  const missingAt20 = goldDepth.filter(
    (entry) => entry.bucket !== 'present_at_20',
  );
  if (missingAt20.length > 0 && input.rankedChunks.length > 0) {
    const corpusInTop = new Set(input.rankedChunks.map((chunk) => chunk.corpusId));
    for (const entry of missingAt20) {
      if (corpusInTop.has(entry.gold.corpusId)) {
        patterns.push('meme-corpus-articles-voisins');
        break;
      }
    }
  }

  return {
    questionId: input.questionId,
    questionType: input.questionType,
    routedCorpusIds: input.routedCorpusIds,
    goldArticles: input.goldArticles,
    strategy: input.strategy,
    dataSource: input.dataSource,
    observedMaxK: input.observedMaxK,
    metricsByK,
    goldDepth,
    patterns: [...new Set(patterns)],
  };
}

export function inferPatternsForQuestion(
  result: RetrievalDepthQuestionResult,
  rankedChunks: RankedRetrievalChunk[],
): string[] {
  const patterns = [...result.patterns];
  const topArticles = new Set(
    rankedChunks.slice(0, 20).map((chunk) => `${chunk.corpusId}:${chunk.articleNumber}`),
  );

  for (const entry of result.goldDepth) {
    if (entry.bucket === 'present_at_20') {
      continue;
    }
    const sameCorpusChunks = rankedChunks.filter(
      (chunk) => chunk.corpusId === entry.gold.corpusId,
    );
    if (sameCorpusChunks.length > 0) {
      patterns.push('corpus-represente-mais-mauvais-article');
    }
    const neighbor = rankedChunks.find(
      (chunk) =>
        chunk.corpusId === entry.gold.corpusId &&
        chunk.articleNumber.startsWith(entry.gold.articleNumber.split('-')[0] ?? ''),
    );
    if (neighbor && !topArticles.has(`${entry.gold.corpusId}:${entry.gold.articleNumber}`)) {
      patterns.push('articles-juridiquement-proches');
    }
  }

  return [...new Set(patterns)];
}

export interface MarginalGoldBandSummary {
  band: '21-30' | '31-40' | '41-50';
  newGoldArticles: number;
}

export interface GoldRankDetail {
  questionId: string;
  gold: GoldArticle;
  strategy: RetrievalDepthStrategy;
  rank20: number | null;
  rank30: number | null;
  rank40: number | null;
  rank50: number | null;
  distanceAtFirstHit: number | null;
  absentAt20: boolean;
  depthBand: 'present_at_20' | '21-30' | '31-40' | '41-50' | 'absent_at_50';
}

export type DepthDecisionCategory =
  | 'DEPTH_IS_MATERIAL'
  | 'SEMANTIC_CEILING'
  | 'MIXED';

export function goldRankDetailForStrategy(input: {
  questionId: string;
  gold: GoldArticle;
  strategy: RetrievalDepthStrategy;
  rankedAt50: RankedRetrievalChunk[];
}): GoldRankDetail {
  const ranks: Partial<Record<RetrievalDepthK, number | null>> = {};
  for (const k of RETRIEVAL_DEPTH_K_VALUES) {
    ranks[k] = firstRankForGold(
      input.gold,
      sliceRankedChunksAtK(input.rankedAt50, k),
    );
  }

  const rank20 = ranks[20] ?? null;
  const rank50 = ranks[50] ?? null;
  let depthBand: GoldRankDetail['depthBand'] = 'absent_at_50';
  if (rank20 !== null) {
    depthBand = 'present_at_20';
  } else if (ranks[30] !== null && ranks[30] !== undefined) {
    depthBand = '21-30';
  } else if (ranks[40] !== null && ranks[40] !== undefined) {
    depthBand = '31-40';
  } else if (rank50 !== null) {
    depthBand = '41-50';
  }

  const firstHitRank =
    rank20 ?? ranks[30] ?? ranks[40] ?? rank50 ?? null;
  const hitChunk =
    firstHitRank === null
      ? undefined
      : input.rankedAt50.find(
          (chunk) =>
            goldArticlesMatch(input.gold, chunk) && chunk.rank === firstHitRank,
        );

  return {
    questionId: input.questionId,
    gold: input.gold,
    strategy: input.strategy,
    rank20,
    rank30: ranks[30] ?? null,
    rank40: ranks[40] ?? null,
    rank50,
    distanceAtFirstHit: hitChunk?.distance ?? null,
    absentAt20: rank20 === null,
    depthBand,
  };
}

export function summarizeMarginalGoldBands(
  details: GoldRankDetail[],
  onlyAbsentAt20 = true,
): MarginalGoldBandSummary[] {
  const scoped = onlyAbsentAt20
    ? details.filter((detail) => detail.absentAt20)
    : details;

  return [
    {
      band: '21-30',
      newGoldArticles: scoped.filter((detail) => detail.depthBand === '21-30')
        .length,
    },
    {
      band: '31-40',
      newGoldArticles: scoped.filter((detail) => detail.depthBand === '31-40')
        .length,
    },
    {
      band: '41-50',
      newGoldArticles: scoped.filter((detail) => detail.depthBand === '41-50')
        .length,
    },
  ];
}

export function classifyDepthDecision(input: {
  absentAt20Details: GoldRankDetail[];
  recallAt20: number;
  recallAt50: number;
}): {
  category: DepthDecisionCategory;
  rationale: string;
  recovered21to50: number;
  stillAbsentAt50: number;
} {
  const recovered21to50 = input.absentAt20Details.filter(
    (detail) =>
      detail.depthBand === '21-30' ||
      detail.depthBand === '31-40' ||
      detail.depthBand === '41-50',
  ).length;
  const stillAbsentAt50 = input.absentAt20Details.filter(
    (detail) => detail.depthBand === 'absent_at_50',
  ).length;
  const totalAbsentAt20 = input.absentAt20Details.length;

  const recallGain = input.recallAt50 - input.recallAt20;
  const recoveredShare =
    totalAbsentAt20 === 0 ? 0 : recovered21to50 / totalAbsentAt20;

  if (
    totalAbsentAt20 > 0 &&
    recoveredShare >= 0.35 &&
    recallGain >= 0.08
  ) {
    return {
      category: 'MIXED',
      rationale:
        'Part significative recuperee entre 21-50 mais une fraction reste absente a 50.',
      recovered21to50,
      stillAbsentAt50,
    };
  }

  if (
    recoveredShare >= 0.5 ||
    (recallGain >= 0.12 && recovered21to50 >= 3)
  ) {
    return {
      category: 'DEPTH_IS_MATERIAL',
      rationale:
        'Une proportion notable des gold absents @20 apparait entre 21 et 50 avec gain de recall mesurable.',
      recovered21to50,
      stillAbsentAt50,
    };
  }

  if (stillAbsentAt50 >= totalAbsentAt20 * 0.6 || recallGain < 0.05) {
    return {
      category: 'SEMANTIC_CEILING',
      rationale:
        'La majorite des gold absents @20 reste absente a 50; le recall plafonne.',
      recovered21to50,
      stillAbsentAt50,
    };
  }

  return {
    category: 'MIXED',
    rationale:
      'Signal mixte: gains partiels 21-50 sans domination claire profondeur vs plafond.',
    recovered21to50,
    stillAbsentAt50,
  };
}

export function buildCorpusNeighborWindow(input: {
  questionId: string;
  gold: GoldArticle;
  corpusLocalList: RankedRetrievalChunk[];
  windowStart?: number;
  windowEnd?: number;
}): Array<{
  rank: number;
  corpusId: string;
  articleNumber: string;
  distance: number | undefined;
  isGold: boolean;
}> {
  const goldRank =
    firstRankForGold(input.gold, input.corpusLocalList) ??
    input.corpusLocalList.length + 1;
  const start = input.windowStart ?? Math.max(1, goldRank - 5);
  const end = input.windowEnd ?? goldRank + 5;

  return input.corpusLocalList
    .filter((chunk) => chunk.rank >= start && chunk.rank <= end)
    .map((chunk) => ({
      rank: chunk.rank,
      corpusId: chunk.corpusId,
      articleNumber: chunk.articleNumber,
      distance: chunk.distance,
      isGold: goldArticlesMatch(input.gold, chunk),
    }));
}
