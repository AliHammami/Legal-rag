import {
  computeRelativeScore,
  dynamicContextFilter,
} from '../../generation/dynamic-context-filter.js';
import {
  DEFAULT_RELATIVE_SCORE_THRESHOLD,
  MAX_CONTEXT_CHUNKS,
} from '../../generation/constants.js';
import {
  goldArticlesMatch,
  goldCorpusIdsFromArticles,
  type GoldArticle,
} from '../gold-article.js';
import type { RerankedChunk } from '../../reranking/types.js';

export const QUOTA_AUDIT_THRESHOLDS = [
  0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5,
] as const;

export type MulticorpusGoldClassification = 'A' | 'B' | 'C' | 'OTHER';

export interface PersistedRetrievalChunk {
  chunkId: string;
  corpusId: string;
  articleNumber: string;
  retrievalDistance: number;
  retrievalRank: number;
}

export interface PersistedRerankChunk {
  chunkId: string;
  corpusId: string;
  articleNumber: string;
  rerankScore: number;
  rerankRank: number;
}

export interface PersistedFilterChunk {
  chunkId: string;
  corpusId: string;
  articleNumber: string;
  rerankScore: number;
  relativeScore: number;
  kept: boolean;
}

export interface StageCoverageMetrics {
  routedCorpusCoverage: number;
  goldCorpusCoverage: number;
  goldArticleHits: GoldArticle[];
  goldArticleHitCount: number;
  goldArticleTotal: number;
}

export interface QuestionQuotaAuditRecord {
  questionId: string;
  question: string;
  routedCorpusIds: string[];
  goldCorpusIds: string[];
  goldArticles: GoldArticle[];
  retrieval: PersistedRetrievalChunk[];
  rerank: PersistedRerankChunk[];
  filter: {
    threshold: number;
    chunks: PersistedFilterChunk[];
    filterCount: number;
    finalCorpusIds: string[];
    finalArticleNumbers: string[];
  };
  coverage: {
    retrieval: StageCoverageMetrics;
    rerank: StageCoverageMetrics;
    filter: StageCoverageMetrics;
  };
  classification: {
    byRoutedCorpus: MulticorpusGoldClassification | 'OTHER';
    byGoldCorpus: MulticorpusGoldClassification | 'OTHER';
  };
}

export interface ThresholdGridRow {
  threshold: number;
  twoRoutedCorpora: number;
  oneRoutedCorpus: number;
  zeroRoutedCorpora: number;
  twoGoldCorpora: number;
  oneGoldCorpus: number;
  zeroGoldCorpora: number;
  goldArticleHits: number;
  goldArticleTotal: number;
  goldArticleRecall: number;
  averageChunksKept: number;
  averageChunksKeptPerCorpus: number;
}

function corpusCoverageCount(
  chunks: Array<{ corpusId: string }>,
  corpusIds: string[],
): number {
  const represented = new Set(chunks.map((chunk) => chunk.corpusId));
  return corpusIds.filter((corpusId) => represented.has(corpusId)).length;
}

export function goldArticlesPresent(
  chunks: Array<{ corpusId: string; articleNumber: string }>,
  goldArticles: GoldArticle[],
): GoldArticle[] {
  return goldArticles.filter((gold) =>
    chunks.some((chunk) => goldArticlesMatch(gold, chunk)),
  );
}

export function toRerankedChunksFromPersisted(
  rerank: PersistedRerankChunk[],
): RerankedChunk[] {
  return rerank.map((entry) => ({
    corpusId: entry.corpusId,
    chunkId: entry.chunkId,
    articleNumber: entry.articleNumber,
    content: '',
    distance: 0,
    rerankScore: entry.rerankScore,
    metadata: {
      articleNumber: entry.articleNumber,
      pageStart: 0,
      pageEnd: 0,
      source: '',
      sourceType: 'pdf' as const,
      chunkIndex: 0,
      chunkCount: 1,
      unitStart: 0,
      unitEnd: 0,
      unitCount: 1,
    },
  }));
}

export function buildFilterAuditDetails(
  reranked: RerankedChunk[],
  threshold: number = DEFAULT_RELATIVE_SCORE_THRESHOLD,
): {
  chunks: PersistedFilterChunk[];
  kept: RerankedChunk[];
} {
  const cappedInput = reranked.slice(0, MAX_CONTEXT_CHUNKS);
  const bestScore = cappedInput[0]?.rerankScore ?? 0;
  const kept = dynamicContextFilter(reranked, { relativeScoreThreshold: threshold });
  const keptIds = new Set(kept.map((chunk) => chunk.chunkId));

  const chunks = cappedInput.map((chunk, index) => ({
    chunkId: chunk.chunkId,
    corpusId: chunk.corpusId,
    articleNumber: chunk.articleNumber,
    rerankScore: chunk.rerankScore ?? 0,
    relativeScore: computeRelativeScore(chunk.rerankScore ?? 0, bestScore),
    kept: keptIds.has(chunk.chunkId),
  }));

  return { chunks, kept };
}

export function classifyByCorpusPresence(
  corpusIds: string[],
  retrievalCorpusCount: number,
  rerankCorpusCount: number,
  filterCorpusCount: number,
): MulticorpusGoldClassification | 'OTHER' {
  if (corpusIds.length !== 2) {
    return 'OTHER';
  }

  if (filterCorpusCount === 2) {
    return 'A';
  }

  if (retrievalCorpusCount === 2 && rerankCorpusCount < 2) {
    return 'B';
  }

  if (
    retrievalCorpusCount === 2 &&
    rerankCorpusCount === 2 &&
    filterCorpusCount < 2
  ) {
    return 'C';
  }

  return 'OTHER';
}

export function buildStageCoverageMetrics(
  chunks: Array<{ corpusId: string; articleNumber: string }>,
  routedCorpusIds: string[],
  goldCorpusIds: string[],
  goldArticles: GoldArticle[],
): StageCoverageMetrics {
  const hits = goldArticlesPresent(chunks, goldArticles);

  return {
    routedCorpusCoverage: corpusCoverageCount(chunks, routedCorpusIds),
    goldCorpusCoverage: corpusCoverageCount(chunks, goldCorpusIds),
    goldArticleHits: hits,
    goldArticleHitCount: hits.length,
    goldArticleTotal: goldArticles.length,
  };
}

export function simulateMinOneChunkPerRoutedCorpus(
  reranked: RerankedChunk[],
  routedCorpusIds: string[],
  threshold: number,
): RerankedChunk[] {
  const filtered = dynamicContextFilter(reranked, {
    relativeScoreThreshold: threshold,
  });
  const cappedInput = reranked.slice(0, MAX_CONTEXT_CHUNKS);
  const rankIndex = new Map(cappedInput.map((chunk, index) => [chunk.chunkId, index]));
  const resultById = new Map(filtered.map((chunk) => [chunk.chunkId, chunk]));

  for (const corpusId of routedCorpusIds) {
    const corpusChunks = cappedInput.filter((chunk) => chunk.corpusId === corpusId);
    if (corpusChunks.length === 0) {
      continue;
    }

    const hasCorpus = [...resultById.values()].some(
      (chunk) => chunk.corpusId === corpusId,
    );
    if (hasCorpus) {
      continue;
    }

    const best = [...corpusChunks].sort(
      (left, right) => (right.rerankScore ?? 0) - (left.rerankScore ?? 0),
    )[0]!;
    resultById.set(best.chunkId, best);
  }

  return [...resultById.values()]
    .sort(
      (left, right) =>
        (rankIndex.get(left.chunkId) ?? 99) - (rankIndex.get(right.chunkId) ?? 99),
    )
    .slice(0, MAX_CONTEXT_CHUNKS);
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function averageChunksPerCorpus(chunks: Array<{ corpusId: string }>): number {
  const counts = new Map<string, number>();
  for (const chunk of chunks) {
    counts.set(chunk.corpusId, (counts.get(chunk.corpusId) ?? 0) + 1);
  }

  if (counts.size === 0) {
    return 0;
  }

  return average([...counts.values()]);
}

export function evaluateThresholdGridRow(
  records: QuestionQuotaAuditRecord[],
  threshold: number,
  strategy: 'standard' | 'minOnePerRoutedCorpus',
): ThresholdGridRow {
  const routedCounts: number[] = [];
  const goldCounts: number[] = [];
  const chunksKept: number[] = [];
  const chunksPerCorpus: number[] = [];
  let goldHits = 0;
  let goldTotal = 0;
  let twoRouted = 0;
  let oneRouted = 0;
  let zeroRouted = 0;
  let twoGold = 0;
  let oneGold = 0;
  let zeroGold = 0;

  for (const record of records) {
    const reranked = toRerankedChunksFromPersisted(record.rerank);
    const filtered =
      strategy === 'standard'
        ? dynamicContextFilter(reranked, { relativeScoreThreshold: threshold })
        : simulateMinOneChunkPerRoutedCorpus(
            reranked,
            record.routedCorpusIds,
            threshold,
          );

    const routedCount = corpusCoverageCount(filtered, record.routedCorpusIds);
    const goldCount = corpusCoverageCount(filtered, record.goldCorpusIds);
    routedCounts.push(routedCount);
    goldCounts.push(goldCount);
    chunksKept.push(filtered.length);
    chunksPerCorpus.push(averageChunksPerCorpus(filtered));

    if (routedCount === 2) twoRouted += 1;
    else if (routedCount === 1) oneRouted += 1;
    else zeroRouted += 1;

    if (goldCount === 2) twoGold += 1;
    else if (goldCount === 1) oneGold += 1;
    else zeroGold += 1;

    const hits = goldArticlesPresent(filtered, record.goldArticles);
    goldHits += hits.length;
    goldTotal += record.goldArticles.length;
  }

  return {
    threshold,
    twoRoutedCorpora: twoRouted,
    oneRoutedCorpus: oneRouted,
    zeroRoutedCorpora: zeroRouted,
    twoGoldCorpora: twoGold,
    oneGoldCorpus: oneGold,
    zeroGoldCorpora: zeroGold,
    goldArticleHits: goldHits,
    goldArticleTotal: goldTotal,
    goldArticleRecall: goldTotal > 0 ? goldHits / goldTotal : 0,
    averageChunksKept: average(chunksKept),
    averageChunksKeptPerCorpus: average(chunksPerCorpus),
  };
}

export function evaluateThresholdGrid(
  records: QuestionQuotaAuditRecord[],
  thresholds: readonly number[] = QUOTA_AUDIT_THRESHOLDS,
  strategy: 'standard' | 'minOnePerRoutedCorpus' = 'standard',
): ThresholdGridRow[] {
  return thresholds.map((threshold) =>
    evaluateThresholdGridRow(records, threshold, strategy),
  );
}

export interface QuotaAuditSummary {
  evaluatedQuestionCount: number;
  routedCorpus: {
    retrievalBoth: number;
    rerankBoth: number;
    filterBoth: number;
  };
  goldCorpus: {
    retrievalBoth: number;
    rerankBoth: number;
    filterBoth: number;
  };
  goldArticles: {
    retrievalHits: number;
    rerankHits: number;
    filterHits: number;
    total: number;
  };
  classificationByRoutedCorpus: Record<MulticorpusGoldClassification | 'OTHER', number>;
  classificationByGoldCorpus: Record<MulticorpusGoldClassification | 'OTHER', number>;
}

export function summarizeQuotaAuditRecords(
  records: QuestionQuotaAuditRecord[],
): QuotaAuditSummary {
  const classificationByRoutedCorpus = {
    A: 0,
    B: 0,
    C: 0,
    OTHER: 0,
  };
  const classificationByGoldCorpus = {
    A: 0,
    B: 0,
    C: 0,
    OTHER: 0,
  };

  let retrievalRoutedBoth = 0;
  let rerankRoutedBoth = 0;
  let filterRoutedBoth = 0;
  let retrievalGoldBoth = 0;
  let rerankGoldBoth = 0;
  let filterGoldBoth = 0;
  let retrievalGoldHits = 0;
  let rerankGoldHits = 0;
  let filterGoldHits = 0;
  let goldTotal = 0;

  for (const record of records) {
    classificationByRoutedCorpus[record.classification.byRoutedCorpus] += 1;
    classificationByGoldCorpus[record.classification.byGoldCorpus] += 1;

    if (record.coverage.retrieval.routedCorpusCoverage === 2) retrievalRoutedBoth += 1;
    if (record.coverage.rerank.routedCorpusCoverage === 2) rerankRoutedBoth += 1;
    if (record.coverage.filter.routedCorpusCoverage === 2) filterRoutedBoth += 1;

    if (record.goldCorpusIds.length === 2) {
      if (record.coverage.retrieval.goldCorpusCoverage === 2) retrievalGoldBoth += 1;
      if (record.coverage.rerank.goldCorpusCoverage === 2) rerankGoldBoth += 1;
      if (record.coverage.filter.goldCorpusCoverage === 2) filterGoldBoth += 1;
    }

    retrievalGoldHits += record.coverage.retrieval.goldArticleHitCount;
    rerankGoldHits += record.coverage.rerank.goldArticleHitCount;
    filterGoldHits += record.coverage.filter.goldArticleHitCount;
    goldTotal += record.coverage.filter.goldArticleTotal;
  }

  return {
    evaluatedQuestionCount: records.length,
    routedCorpus: {
      retrievalBoth: retrievalRoutedBoth,
      rerankBoth: rerankRoutedBoth,
      filterBoth: filterRoutedBoth,
    },
    goldCorpus: {
      retrievalBoth: retrievalGoldBoth,
      rerankBoth: rerankGoldBoth,
      filterBoth: filterGoldBoth,
    },
    goldArticles: {
      retrievalHits: retrievalGoldHits,
      rerankHits: rerankGoldHits,
      filterHits: filterGoldHits,
      total: goldTotal,
    },
    classificationByRoutedCorpus,
    classificationByGoldCorpus,
  };
}

function formatPercent(numerator: number, denominator: number): string {
  if (denominator === 0) {
    return 'n/a';
  }

  return `${((numerator / denominator) * 100).toFixed(1)}% (${numerator}/${denominator})`;
}

function formatGridRow(row: ThresholdGridRow): string {
  return `| ${row.threshold.toFixed(2)} | ${row.twoRoutedCorpora} | ${row.oneRoutedCorpus} | ${row.zeroRoutedCorpora} | ${row.goldArticleHits}/${row.goldArticleTotal} (${(row.goldArticleRecall * 100).toFixed(1)}%) | ${row.twoGoldCorpora} | ${row.averageChunksKept.toFixed(2)} | ${row.averageChunksKeptPerCorpus.toFixed(2)} |`;
}

export function buildQuotaAuditReportMarkdown(input: {
  summary: QuotaAuditSummary;
  standardGrid: ThresholdGridRow[];
  minOneCorpusGrid: ThresholdGridRow[];
  representativeCases: {
    filterTooAggressive: QuestionQuotaAuditRecord[];
    rerankLoss: QuestionQuotaAuditRecord[];
    quotaImproved: QuestionQuotaAuditRecord[];
    quotaDegraded: QuestionQuotaAuditRecord[];
  };
  baselineComparison?: {
    previousSmokePath: string;
    routedFilterBothDelta: number;
  };
}): string {
  const { summary, standardGrid, minOneCorpusGrid, representativeCases } = input;
  const n = summary.evaluatedQuestionCount;

  const lines = [
    '# Re-smoke enrichi - Reranking + Dynamic Filter multicorpus (quota)',
    '',
    '## A. Resume',
    '',
    '```text',
    `${n} questions`,
    '',
    'Routed corpus coverage:',
    `  Retrieval : ${summary.routedCorpus.retrievalBoth}/${n}`,
    `  Rerank    : ${summary.routedCorpus.rerankBoth}/${n}`,
    `  Filter    : ${summary.routedCorpus.filterBoth}/${n}`,
    '',
    'Gold corpus coverage (questions avec 2 gold corpora):',
    `  Retrieval : ${summary.goldCorpus.retrievalBoth}`,
    `  Rerank    : ${summary.goldCorpus.rerankBoth}`,
    `  Filter    : ${summary.goldCorpus.filterBoth}`,
    '',
    'Gold article coverage:',
    `  Retrieval : ${summary.goldArticles.retrievalHits}/${summary.goldArticles.total}`,
    `  Rerank    : ${summary.goldArticles.rerankHits}/${summary.goldArticles.total}`,
    `  Filter    : ${summary.goldArticles.filterHits}/${summary.goldArticles.total}`,
    '```',
    '',
    '## B. Classification',
    '',
    '### Par corpus routes',
    '',
    '```text',
    `A = ${summary.classificationByRoutedCorpus.A}`,
    `B = ${summary.classificationByRoutedCorpus.B}`,
    `C = ${summary.classificationByRoutedCorpus.C}`,
    `OTHER = ${summary.classificationByRoutedCorpus.OTHER}`,
    '```',
    '',
    '### Par corpus gold',
    '',
    '```text',
    `A = ${summary.classificationByGoldCorpus.A}`,
    `B = ${summary.classificationByGoldCorpus.B}`,
    `C = ${summary.classificationByGoldCorpus.C}`,
    `OTHER = ${summary.classificationByGoldCorpus.OTHER}`,
    '```',
    '',
    '## C. Gold article coverage',
    '',
    '| etape | Hits | Total | Recall |',
    '|-------|------|-------|--------|',
    `| retrieval | ${summary.goldArticles.retrievalHits} | ${summary.goldArticles.total} | ${formatPercent(summary.goldArticles.retrievalHits, summary.goldArticles.total)} |`,
    `| rerank | ${summary.goldArticles.rerankHits} | ${summary.goldArticles.total} | ${formatPercent(summary.goldArticles.rerankHits, summary.goldArticles.total)} |`,
    `| filter @0.4 | ${summary.goldArticles.filterHits} | ${summary.goldArticles.total} | ${formatPercent(summary.goldArticles.filterHits, summary.goldArticles.total)} |`,
    '',
    '## D. Threshold grid (filter standard, offline)',
    '',
    '| threshold | 2 routed | 1 routed | 0 routed | gold articles | 2 gold corp | avg chunks | avg/corpus |',
    '|-----------|----------|----------|----------|---------------|-------------|------------|------------|',
    ...standardGrid.map(formatGridRow),
    '',
    '## E. Min-1-corpus grid (simulation offline)',
    '',
    '| threshold | 2 routed | 1 routed | 0 routed | gold articles | 2 gold corp | avg chunks | avg/corpus |',
    '|-----------|----------|----------|----------|---------------|-------------|------------|------------|',
    ...minOneCorpusGrid.map(formatGridRow),
    '',
    '## F. Cas representatifs',
    '',
  ];

  const addCases = (
    title: string,
    records: QuestionQuotaAuditRecord[],
  ): void => {
    lines.push(`### ${title}`, '');
    for (const record of records.slice(0, 3)) {
      lines.push(`**${record.questionId}** - ${record.question}`, '');
      lines.push(
        `- Classification routed: ${record.classification.byRoutedCorpus} / gold: ${record.classification.byGoldCorpus}`,
      );
      lines.push(
        `- Rerank: ${record.rerank.map((entry) => `${entry.rerankRank}. ${entry.corpusId}/${entry.articleNumber} (${entry.rerankScore.toFixed(4)})`).join('; ')}`,
      );
      lines.push(
        `- Filter @${record.filter.threshold}: kept ${record.filter.chunks.filter((chunk) => chunk.kept).map((chunk) => `${chunk.corpusId}/${chunk.articleNumber} rel=${chunk.relativeScore.toFixed(3)}`).join(', ') || 'none'}`,
      );
      lines.push('');
    }
  };

  addCases('Filter trop agressif', representativeCases.filterTooAggressive);
  addCases('Perte au rerank', representativeCases.rerankLoss);
  addCases('Quota ameliore la couverture', representativeCases.quotaImproved);
  addCases('Quota degrade le top-5', representativeCases.quotaDegraded);

  const current040 = standardGrid.find((row) => row.threshold === 0.4);
  const candidate030 = standardGrid.find((row) => row.threshold === 0.3);
  const candidate025 = standardGrid.find((row) => row.threshold === 0.25);
  const min040 = minOneCorpusGrid.find((row) => row.threshold === 0.4);
  const cRecoveredAt025 =
    candidate025 && current040
      ? candidate025.twoRoutedCorpora - current040.twoRoutedCorpora
      : null;

  lines.push(
    '## G. Conclusion',
    '',
    `1. **Threshold standard :** @0.25 -> ${candidate025?.twoRoutedCorpora ?? 'n/a'}/${n} routed bi-corpus, gold ${candidate025?.goldArticleHits ?? 'n/a'}/${candidate025?.goldArticleTotal ?? 'n/a'} (${candidate025 ? (candidate025.goldArticleRecall * 100).toFixed(1) : 'n/a'}%), avg chunks ${candidate025?.averageChunksKept.toFixed(2) ?? 'n/a'}. @0.30 -> ${candidate030?.twoRoutedCorpora ?? 'n/a'}/${n}, gold ${candidate030 ? (candidate030.goldArticleRecall * 100).toFixed(1) : 'n/a'}%, avg ${candidate030?.averageChunksKept.toFixed(2) ?? 'n/a'}.`,
    `2. **Min 1 chunk / corpus :** @0.40 -> ${min040?.twoRoutedCorpora ?? 'n/a'}/${n} routed bi-corpus, gold ${min040?.goldArticleHits ?? 'n/a'}/${min040?.goldArticleTotal ?? 'n/a'} (${min040 ? (min040.goldArticleRecall * 100).toFixed(1) : 'n/a'}%), avg chunks ${min040?.averageChunksKept.toFixed(2) ?? 'n/a'}. Meilleur compromis couverture/bruit sur cette cohorte.`,
    `3. **Cas C recuperes :** standard @0.25 recupere ${cRecoveredAt025 ?? 'n/a'}/${summary.classificationByRoutedCorpus.C} cas C; min-1-corpus @0.40 recupere ${min040 && current040 ? min040.twoRoutedCorpora - current040.twoRoutedCorpora : 'n/a'}/${summary.classificationByRoutedCorpus.C} avec +${min040 && current040 ? (min040.averageChunksKept - current040.averageChunksKept).toFixed(2) : 'n/a'} chunks en moyenne.`,
    `4. **Cout bruit :** @0.40 actuel = ${current040?.averageChunksKept.toFixed(2) ?? 'n/a'} chunks/q; standard @0.25 = ${candidate025?.averageChunksKept.toFixed(2) ?? 'n/a'}; min-1 @0.40 = ${min040?.averageChunksKept.toFixed(2) ?? 'n/a'}.`,
    `5. **Cas B (rerank) :** ${summary.classificationByRoutedCorpus.B} questions - secondaire vs filter (${summary.classificationByRoutedCorpus.C} cas C).`,
    '6. **Prochaine etape :** smoke generation + judge sur ~15 questions avec min-1-corpus @0.40 vs standard @0.25.',
    '',
  );

  if (input.baselineComparison) {
    lines.push(
      '## Comparaison smoke precedent (routed corpus @ filter)',
      '',
      `Smoke precedent : ${input.baselineComparison.previousSmokePath}`,
      `Delta filter 2 corpus : ${input.baselineComparison.routedFilterBothDelta >= 0 ? '+' : ''}${input.baselineComparison.routedFilterBothDelta}`,
      '',
    );
  }

  return `${lines.join('\n')}\n`;
}

export function pickRepresentativeCases(
  records: QuestionQuotaAuditRecord[],
): {
  filterTooAggressive: QuestionQuotaAuditRecord[];
  rerankLoss: QuestionQuotaAuditRecord[];
  quotaImproved: QuestionQuotaAuditRecord[];
  quotaDegraded: QuestionQuotaAuditRecord[];
} {
  return {
    filterTooAggressive: records.filter(
      (record) => record.classification.byRoutedCorpus === 'C',
    ),
    rerankLoss: records.filter(
      (record) => record.classification.byRoutedCorpus === 'B',
    ),
    quotaImproved: records.filter(
      (record) =>
        record.coverage.retrieval.routedCorpusCoverage === 2 &&
        record.coverage.retrieval.goldArticleHitCount >
          record.coverage.filter.goldArticleHitCount,
    ),
    quotaDegraded: records.filter(
      (record) => record.classification.byRoutedCorpus === 'B',
    ),
  };
}

export function buildQuestionQuotaAuditRecord(input: {
  questionId: string;
  question: string;
  routedCorpusIds: string[];
  goldArticles: GoldArticle[];
  retrieval: PersistedRetrievalChunk[];
  rerank: PersistedRerankChunk[];
  filterThreshold?: number;
}): QuestionQuotaAuditRecord {
  const goldCorpusIds = goldCorpusIdsFromArticles(input.goldArticles);
  const reranked = toRerankedChunksFromPersisted(input.rerank);
  const threshold = input.filterThreshold ?? DEFAULT_RELATIVE_SCORE_THRESHOLD;
  const filterDetails = buildFilterAuditDetails(reranked, threshold);
  const keptChunks = filterDetails.kept;

  const retrievalCoverage = buildStageCoverageMetrics(
    input.retrieval,
    input.routedCorpusIds,
    goldCorpusIds,
    input.goldArticles,
  );
  const rerankCoverage = buildStageCoverageMetrics(
    input.rerank,
    input.routedCorpusIds,
    goldCorpusIds,
    input.goldArticles,
  );
  const filterCoverage = buildStageCoverageMetrics(
    keptChunks,
    input.routedCorpusIds,
    goldCorpusIds,
    input.goldArticles,
  );

  return {
    questionId: input.questionId,
    question: input.question,
    routedCorpusIds: input.routedCorpusIds,
    goldCorpusIds,
    goldArticles: input.goldArticles,
    retrieval: input.retrieval,
    rerank: input.rerank,
    filter: {
      threshold,
      chunks: filterDetails.chunks,
      filterCount: keptChunks.length,
      finalCorpusIds: [...new Set(keptChunks.map((chunk) => chunk.corpusId))].sort(),
      finalArticleNumbers: keptChunks.map((chunk) => chunk.articleNumber),
    },
    coverage: {
      retrieval: retrievalCoverage,
      rerank: rerankCoverage,
      filter: filterCoverage,
    },
    classification: {
      byRoutedCorpus: classifyByCorpusPresence(
        input.routedCorpusIds,
        retrievalCoverage.routedCorpusCoverage,
        rerankCoverage.routedCorpusCoverage,
        filterCoverage.routedCorpusCoverage,
      ),
      byGoldCorpus: classifyByCorpusPresence(
        goldCorpusIds,
        retrievalCoverage.goldCorpusCoverage,
        rerankCoverage.goldCorpusCoverage,
        filterCoverage.goldCorpusCoverage,
      ),
    },
  };
}
