import {
  goldArticlesMatch,
  type GoldArticle,
} from '../gold-article.js';
import type { GenerationForensicRecord } from './generation-forensic-audit.js';
import {
  goldArticlesPresent,
  simulateMinOneChunkPerRoutedCorpus,
  toRerankedChunksFromPersisted,
  type PersistedRetrievalChunk,
  type PersistedRerankChunk,
  type QuestionQuotaAuditRecord,
} from './rerank-filter-quota-audit.js';
import { dynamicContextFilter } from '../../generation/dynamic-context-filter.js';
import { DEFAULT_RELATIVE_SCORE_THRESHOLD } from '../../generation/constants.js';

export type ContextLossReason = 'R0' | 'R1' | 'R2' | 'R3' | 'R4';

export type ContextLossStageBucket =
  | 'retrieval'
  | 'reranking'
  | 'filter'
  | 'mapping'
  | 'indeterminate';

export const CONTEXT_LOSS_STAGE_BY_REASON: Record<
  ContextLossReason,
  ContextLossStageBucket
> = {
  R0: 'retrieval',
  R1: 'reranking',
  R2: 'filter',
  R3: 'mapping',
  R4: 'indeterminate',
};

export type StageTraceSource =
  | 'e2e500-final-only'
  | 'quota-audit-proxy-replay';

export interface GoldArticleLossDetail {
  gold: GoldArticle;
  reason: ContextLossReason;
  stage: ContextLossStageBucket;
  notes?: string;
  retrievalRank?: number;
  rerankRank?: number;
  inFilteredContext?: boolean;
}

export interface ContextLossForensicRecord {
  questionId: string;
  question: string;
  questionType: GenerationForensicRecord['questionType'];
  difficulty: GenerationForensicRecord['difficulty'];
  routedCorpusIds: string[];
  goldCorpusIds: string[];
  goldArticles: GoldArticle[];
  forensicCategory: GenerationForensicRecord['forensicCategory'];
  forensicRationale: string;
  goldContextCoverage: GenerationForensicRecord['goldContextCoverage'];
  contextSources: GoldArticle[];
  goldArticlesMissingFromContext: GoldArticle[];
  judge: GenerationForensicRecord['judge'];
  sourceJudge: GenerationForensicRecord['sourceJudge'];
  stageTraceSource: StageTraceSource;
  stageTraceLimitations: string[];
  goldArticleLosses: GoldArticleLossDetail[];
  primaryLossStage: ContextLossStageBucket;
  patterns: string[];
}

export interface StageLossAggregate {
  questionsWithLoss: number;
  goldArticlesLost: number;
}

export interface ContextLossSummary {
  auditedQuestionCount: number;
  byStage: Record<ContextLossStageBucket, StageLossAggregate>;
  byReason: Record<ContextLossReason, number>;
  byQuestionType: Record<
    ContextLossStageBucket,
    { singleCorpus: StageLossAggregate; multiCorpus: StageLossAggregate }
  >;
  stageTraceCoverage: {
    fullPipelineProxy: number;
    finalContextOnly: number;
  };
  offlineMetrics: {
    scope: string;
    goldArticleRecallAt20Retrieval?: number;
    goldArticleRecallAt5Rerank?: number;
    goldArticleRecallFinalContext?: number;
    corpusCoverageRetrieval?: number;
    corpusCoverageRerank?: number;
    corpusCoverageFinal?: number;
    note?: string;
  };
}

function articlePresentInChunks(
  gold: GoldArticle,
  chunks: Array<{ corpusId: string; articleNumber: string }>,
): boolean {
  return chunks.some((chunk) => goldArticlesMatch(gold, chunk));
}

function bestRetrievalRankForGold(
  gold: GoldArticle,
  retrieval: PersistedRetrievalChunk[],
): number | undefined {
  const ranks = retrieval
    .filter((chunk) => goldArticlesMatch(gold, chunk))
    .map((chunk) => chunk.retrievalRank);
  if (ranks.length === 0) {
    return undefined;
  }
  return Math.min(...ranks);
}

function bestRerankRankForGold(
  gold: GoldArticle,
  rerank: PersistedRerankChunk[],
): number | undefined {
  const ranks = rerank
    .filter((chunk) => goldArticlesMatch(gold, chunk))
    .map((chunk) => chunk.rerankRank);
  if (ranks.length === 0) {
    return undefined;
  }
  return Math.min(...ranks);
}

export function applyProductionContextFilter(
  rerank: PersistedRerankChunk[],
  routedCorpusIds: string[],
  threshold: number = DEFAULT_RELATIVE_SCORE_THRESHOLD,
): Array<{ corpusId: string; articleNumber: string; chunkId: string }> {
  const reranked = toRerankedChunksFromPersisted(rerank);
  const filtered =
    routedCorpusIds.length > 1
      ? simulateMinOneChunkPerRoutedCorpus(reranked, routedCorpusIds, threshold)
      : dynamicContextFilter(reranked, { relativeScoreThreshold: threshold });

  return filtered.map((chunk) => ({
    chunkId: chunk.chunkId,
    corpusId: chunk.corpusId,
    articleNumber: chunk.articleNumber,
  }));
}

export function classifyMissingGoldArticle(input: {
  gold: GoldArticle;
  retrieval?: PersistedRetrievalChunk[];
  rerank?: PersistedRerankChunk[];
  filtered?: Array<{ corpusId: string; articleNumber: string }>;
  finalSources: GoldArticle[];
}): GoldArticleLossDetail {
  const { gold, retrieval, rerank, filtered, finalSources } = input;

  if (articlePresentInChunks(gold, finalSources)) {
    return {
      gold,
      reason: 'R3',
      stage: 'mapping',
      notes:
        'Article gold present dans les sources finales E2E mais absent de goldArticlesMissing / categorie A ÿ verifier matching ou judge.',
    };
  }

  if (!retrieval || !rerank || !filtered) {
    return {
      gold,
      reason: 'R4',
      stage: 'indeterminate',
      notes: 'Pas de trace retrieval/rerank/filter dans les artefacts E2E 500.',
    };
  }

  const retrievalRank = bestRetrievalRankForGold(gold, retrieval);
  const rerankRank = bestRerankRankForGold(gold, rerank);
  const inFilteredContext = articlePresentInChunks(gold, filtered);

  if (retrievalRank === undefined) {
    return {
      gold,
      reason: 'R0',
      stage: 'retrieval',
      retrievalRank,
      rerankRank,
      inFilteredContext,
    };
  }

  if (rerankRank === undefined) {
    return {
      gold,
      reason: 'R1',
      stage: 'reranking',
      retrievalRank,
      rerankRank,
      inFilteredContext,
    };
  }

  if (!inFilteredContext) {
    return {
      gold,
      reason: 'R2',
      stage: 'filter',
      retrievalRank,
      rerankRank,
      inFilteredContext,
    };
  }

  return {
    gold,
    reason: 'R4',
    stage: 'indeterminate',
    retrievalRank,
    rerankRank,
    inFilteredContext: true,
    notes:
      'Gold present apres filter (replay production) mais absent des sources finales E2E ÿ perte mapping/context builder ou divergence proxy vs run E2E.',
  };
}

function inferPatterns(record: ContextLossForensicRecord): string[] {
  const patterns: string[] = [];
  const missing = record.goldArticlesMissingFromContext;

  if (record.questionType === 'single-corpus' && record.stageTraceSource === 'e2e500-final-only') {
    patterns.push('single-corpus-sans-artefacts-pipeline');
  }

  if (record.routedCorpusIds.length > 1 && record.stageTraceSource === 'quota-audit-proxy-replay') {
    const r1 = record.goldArticleLosses.filter((loss) => loss.reason === 'R1');
    if (r1.length > 0) {
      patterns.push('multicorpus-gold-perdu-au-rerank-top5');
    }
    const r2 = record.goldArticleLosses.filter((loss) => loss.reason === 'R2');
    if (r2.length > 0) {
      patterns.push('multicorpus-gold-perdu-au-filter-0.40');
    }
    const r0 = record.goldArticleLosses.filter((loss) => loss.reason === 'R0');
    if (r0.length > 0) {
      patterns.push('multicorpus-gold-absent-retrieval-top20');
    }
  }

  if (
    record.goldContextCoverage === 'partial' &&
    missing.length > 0 &&
    record.contextSources.length > 0
  ) {
    patterns.push('couverture-gold-partielle-sources-finales');
  }

  if (
    record.contextSources.length > 0 &&
    missing.every((gold) => gold.corpusId === record.contextSources[0]?.corpusId)
  ) {
    patterns.push('meme-corpus-articles-voisins-au-lieu-du-gold');
  }

  return patterns;
}

function primaryStageFromLosses(
  losses: GoldArticleLossDetail[],
): ContextLossStageBucket {
  const order: ContextLossStageBucket[] = [
    'retrieval',
    'reranking',
    'filter',
    'mapping',
    'indeterminate',
  ];
  for (const stage of order) {
    if (losses.some((loss) => loss.stage === stage)) {
      return stage;
    }
  }
  return 'indeterminate';
}

export function buildContextLossRecord(input: {
  forensic: GenerationForensicRecord;
  routedCorpusIds: string[];
  quotaRecord?: QuestionQuotaAuditRecord;
  filterThreshold?: number;
}): ContextLossForensicRecord {
  const { forensic, routedCorpusIds, quotaRecord } = input;
  const threshold = input.filterThreshold ?? DEFAULT_RELATIVE_SCORE_THRESHOLD;
  const limitations: string[] = [];

  let stageTraceSource: StageTraceSource = 'e2e500-final-only';
  let retrieval: PersistedRetrievalChunk[] | undefined;
  let rerank: PersistedRerankChunk[] | undefined;
  let filtered:
    | Array<{ corpusId: string; articleNumber: string; chunkId: string }>
    | undefined;

  if (quotaRecord) {
    stageTraceSource = 'quota-audit-proxy-replay';
    retrieval = quotaRecord.retrieval;
    rerank = quotaRecord.rerank;
    filtered = applyProductionContextFilter(
      quotaRecord.rerank,
      routedCorpusIds,
      threshold,
    );
    limitations.push(
      'Retrieval/rerank proviennent du quota audit 2026-09-21 (meme config top20/top5/0.40) ÿ pas une re-execution du pipeline E2E 500 question par question.',
    );
    limitations.push(
      'Filter rejoue offline via dynamicContextFilter production (min1/corpus si multicorpus route).',
    );
  } else {
    limitations.push(
      'Run E2E 500 ne persiste pas retrieval top20 ni rerank top5 ÿ localisation pipeline impossible pour cette question.',
    );
  }

  const goldArticleLosses = forensic.goldArticlesMissingFromContext.map((gold) =>
    classifyMissingGoldArticle({
      gold,
      retrieval,
      rerank,
      filtered,
      finalSources: forensic.contextSources,
    }),
  );

  const record: ContextLossForensicRecord = {
    questionId: forensic.questionId,
    question: forensic.question,
    questionType: forensic.questionType,
    difficulty: forensic.difficulty,
    routedCorpusIds,
    goldCorpusIds: forensic.goldCorpusIds,
    goldArticles: forensic.goldArticles,
    forensicCategory: forensic.forensicCategory,
    forensicRationale: forensic.forensicRationale,
    goldContextCoverage: forensic.goldContextCoverage,
    contextSources: forensic.contextSources,
    goldArticlesMissingFromContext: forensic.goldArticlesMissingFromContext,
    judge: forensic.judge,
    sourceJudge: forensic.sourceJudge,
    stageTraceSource,
    stageTraceLimitations: limitations,
    goldArticleLosses,
    primaryLossStage: primaryStageFromLosses(goldArticleLosses),
    patterns: [],
  };

  record.patterns = inferPatterns(record);
  return record;
}

function emptyAggregate(): StageLossAggregate {
  return { questionsWithLoss: 0, goldArticlesLost: 0 };
}

export interface ContextLossMetricInputs {
  proxyQuestionCount: number;
  goldArticleTotal: number;
  goldHitsRetrieval: number;
  goldHitsRerank: number;
  goldHitsFinal: number;
  corpusCoverageRetrievalSum: number;
  corpusCoverageRerankSum: number;
  corpusCoverageFinalSum: number;
  corpusCoverageQuestionCount: number;
}

export function computeContextLossMetrics(
  records: Array<
    ContextLossForensicRecord & {
      pipelineRetrieval?: PersistedRetrievalChunk[];
      pipelineRerank?: PersistedRerankChunk[];
    }
  >,
): ContextLossMetricInputs | null {
  const proxyRecords = records.filter(
    (record) =>
      record.stageTraceSource === 'quota-audit-proxy-replay' &&
      record.pipelineRetrieval &&
      record.pipelineRerank,
  );

  if (proxyRecords.length === 0) {
    return null;
  }

  let goldArticleTotal = 0;
  let goldHitsRetrieval = 0;
  let goldHitsRerank = 0;
  let goldHitsFinal = 0;
  let corpusCoverageRetrievalSum = 0;
  let corpusCoverageRerankSum = 0;
  let corpusCoverageFinalSum = 0;

  for (const record of proxyRecords) {
    const retrieval = record.pipelineRetrieval!;
    const rerank = record.pipelineRerank!;
    goldArticleTotal += record.goldArticles.length;

    for (const gold of record.goldArticles) {
      if (articlePresentInChunks(gold, retrieval)) {
        goldHitsRetrieval += 1;
      }
      if (articlePresentInChunks(gold, rerank)) {
        goldHitsRerank += 1;
      }
      if (articlePresentInChunks(gold, record.contextSources)) {
        goldHitsFinal += 1;
      }
    }

    const goldCorpora = record.goldCorpusIds;
    const retrievalCorpora = new Set(
      goldArticlesPresent(retrieval, record.goldArticles).map(
        (article) => article.corpusId,
      ),
    );
    const rerankCorpora = new Set(
      goldArticlesPresent(rerank, record.goldArticles).map(
        (article) => article.corpusId,
      ),
    );
    const finalCorpora = new Set(record.contextSources.map((source) => source.corpusId));

    corpusCoverageRetrievalSum += goldCorpora.filter((corpusId) =>
      retrievalCorpora.has(corpusId),
    ).length;
    corpusCoverageRerankSum += goldCorpora.filter((corpusId) =>
      rerankCorpora.has(corpusId),
    ).length;
    corpusCoverageFinalSum += goldCorpora.filter((corpusId) =>
      finalCorpora.has(corpusId),
    ).length;
  }

  return {
    proxyQuestionCount: proxyRecords.length,
    goldArticleTotal,
    goldHitsRetrieval,
    goldHitsRerank,
    goldHitsFinal,
    corpusCoverageRetrievalSum,
    corpusCoverageRerankSum,
    corpusCoverageFinalSum,
    corpusCoverageQuestionCount: proxyRecords.length,
  };
}

export function summarizeContextLoss(
  records: ContextLossForensicRecord[],
  metrics: ContextLossMetricInputs | null,
): ContextLossSummary {
  const byStage: Record<ContextLossStageBucket, StageLossAggregate> = {
    retrieval: emptyAggregate(),
    reranking: emptyAggregate(),
    filter: emptyAggregate(),
    mapping: emptyAggregate(),
    indeterminate: emptyAggregate(),
  };

  const byReason: Record<ContextLossReason, number> = {
    R0: 0,
    R1: 0,
    R2: 0,
    R3: 0,
    R4: 0,
  };

  const byQuestionType: ContextLossSummary['byQuestionType'] = {
    retrieval: {
      singleCorpus: emptyAggregate(),
      multiCorpus: emptyAggregate(),
    },
    reranking: {
      singleCorpus: emptyAggregate(),
      multiCorpus: emptyAggregate(),
    },
    filter: {
      singleCorpus: emptyAggregate(),
      multiCorpus: emptyAggregate(),
    },
    mapping: {
      singleCorpus: emptyAggregate(),
      multiCorpus: emptyAggregate(),
    },
    indeterminate: {
      singleCorpus: emptyAggregate(),
      multiCorpus: emptyAggregate(),
    },
  };

  for (const record of records) {
    const typeKey =
      record.questionType === 'single-corpus' ? 'singleCorpus' : 'multiCorpus';
    const stagesHit = new Set<ContextLossStageBucket>();

    for (const loss of record.goldArticleLosses) {
      byReason[loss.reason] += 1;
      stagesHit.add(loss.stage);
      byStage[loss.stage].goldArticlesLost += 1;
      byQuestionType[loss.stage][typeKey].goldArticlesLost += 1;
    }

    for (const stage of stagesHit) {
      byStage[stage].questionsWithLoss += 1;
      byQuestionType[stage][typeKey].questionsWithLoss += 1;
    }
  }

  const fullPipelineProxy = records.filter(
    (record) => record.stageTraceSource === 'quota-audit-proxy-replay',
  ).length;

  const offlineMetrics: ContextLossSummary['offlineMetrics'] = {
    scope:
      'Sous-ensemble 26 questions (proxy quota audit) + rappel final sur les 61 depuis sources E2E',
  };

  if (!metrics || metrics.goldArticleTotal === 0) {
    offlineMetrics.note =
      'Recall @20/@5 non calculable avec les artefacts du run E2E 500 seul (pas de retrieval/rerank persistes).';
  } else {
    offlineMetrics.goldArticleRecallAt20Retrieval =
      metrics.goldHitsRetrieval / metrics.goldArticleTotal;
    offlineMetrics.goldArticleRecallAt5Rerank =
      metrics.goldHitsRerank / metrics.goldArticleTotal;
    offlineMetrics.goldArticleRecallFinalContext =
      metrics.goldHitsFinal / metrics.goldArticleTotal;
    const corpusDenom = metrics.corpusCoverageQuestionCount * 2;
    if (corpusDenom > 0) {
      offlineMetrics.corpusCoverageRetrieval =
        metrics.corpusCoverageRetrievalSum / corpusDenom;
      offlineMetrics.corpusCoverageRerank =
        metrics.corpusCoverageRerankSum / corpusDenom;
      offlineMetrics.corpusCoverageFinal =
        metrics.corpusCoverageFinalSum / corpusDenom;
    }
  }

  let fullCohortFinalHits = 0;
  let fullCohortGoldTotal = 0;
  for (const record of records) {
    fullCohortGoldTotal += record.goldArticles.length;
    fullCohortFinalHits += record.goldArticles.filter((gold) =>
      articlePresentInChunks(gold, record.contextSources),
    ).length;
  }
  offlineMetrics.note = [
    offlineMetrics.note,
    `Rappel article gold contexte final (61 questions E2E): ${fullCohortFinalHits}/${fullCohortGoldTotal} = ${(
      fullCohortFinalHits / Math.max(1, fullCohortGoldTotal)
    ).toFixed(3)}.`,
  ]
    .filter(Boolean)
    .join(' ');

  return {
    auditedQuestionCount: records.length,
    byStage,
    byReason,
    byQuestionType,
    stageTraceCoverage: {
      fullPipelineProxy,
      finalContextOnly: records.length - fullPipelineProxy,
    },
    offlineMetrics,
  };
}

export type ContextLossForensicRecordWithPipeline = ContextLossForensicRecord & {
  pipelineRetrieval?: PersistedRetrievalChunk[];
  pipelineRerank?: PersistedRerankChunk[];
};

export function attachPipelineChunks(
  record: ContextLossForensicRecord,
  quotaRecord: QuestionQuotaAuditRecord,
): ContextLossForensicRecordWithPipeline {
  return {
    ...record,
    pipelineRetrieval: quotaRecord.retrieval,
    pipelineRerank: quotaRecord.rerank,
  };
}
