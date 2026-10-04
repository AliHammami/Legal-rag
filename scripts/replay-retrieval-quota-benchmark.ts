import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { NestFactory } from '@nestjs/core';

import type { GoldArticle } from '../src/evaluation/gold-article.js';
import { DEFAULT_MULTICORPUS_EVALUATION_DATASET_PATH } from '../src/evaluation/constants.js';
import { loadMulticorpusEvaluationDataset } from '../src/evaluation/load-multicorpus-dataset.js';
import type { LegalMulticorpusEvaluationQuestion } from '../src/evaluation/multicorpus-dataset.types.js';
import {
  DEFAULT_MULTICORPUS_RESULTS_DIR,
} from '../src/evaluation/multicorpus/evaluation-config.js';
import type { RoutingQuestionResult } from '../src/evaluation/multicorpus/types.js';
import { OpenAIService } from '../src/openai/openai.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { RerankingPipelineModule } from '../src/reranking/reranking-pipeline.module.js';
import { searchSimilarChunks } from '../src/retrieval/search-similar-chunks.js';
import type { SimilarChunk } from '../src/retrieval/types.js';

type StrategyId = 'baseline_global_20' | 'quota_10_per_corpus_20' | 'quota_15_per_corpus_30';

interface StrategySpec {
  id: StrategyId;
  label: string;
  candidateCount: number;
  perCorpusTopK?: number;
  globalTopK?: number;
}

interface RoutingReportFile {
  results: RoutingQuestionResult[];
}

interface ForensicMultiCase {
  id: string;
  retrievalTop20: Array<{
    corpusId: string;
    articleNumber: string;
    distance?: number;
  }>;
}

interface ForensicFile {
  multiForensics: ForensicMultiCase[];
}

interface QuestionMetrics {
  questionId: string;
  routedCorpusIds: string[];
  goldArticles: GoldArticle[];
  candidateCount: number;
  goldHits: number;
  goldTotal: number;
  corpusRepresented: number;
  monopoly: boolean;
  goldRanks: Array<number | null>;
}

interface StrategyAggregate {
  strategy: StrategySpec;
  questionCount: number;
  totalCandidates: number;
  articleRecallAtK: number;
  goldHits: number;
  goldTotal: number;
  bothCorporaPresentPct: number;
  bothCorporaPresentCount: number;
  oneCorpusPresentCount: number;
  zeroCorpusPresentCount: number;
  monopolyRate: number;
  monopolyCount: number;
  goldRankMin: number | null;
  goldRankMedian: number | null;
  goldRankP90: number | null;
  sqlQueriesPerQuestion: number;
  embeddingsPerQuestion: number;
  perQuestion: QuestionMetrics[];
}

const STRATEGIES: StrategySpec[] = [
  {
    id: 'baseline_global_20',
    label: 'Baseline top-20 global',
    candidateCount: 20,
    globalTopK: 20,
  },
  {
    id: 'quota_10_per_corpus_20',
    label: 'Quota 10/corpus ? 20',
    candidateCount: 20,
    perCorpusTopK: 10,
  },
  {
    id: 'quota_15_per_corpus_30',
    label: 'Quota 15/corpus ? 30',
    candidateCount: 30,
    perCorpusTopK: 15,
  },
];

function dedupeChunks(chunks: SimilarChunk[]): SimilarChunk[] {
  const seen = new Set<string>();
  const merged: SimilarChunk[] = [];

  for (const chunk of chunks) {
    if (seen.has(chunk.chunkId)) {
      continue;
    }
    seen.add(chunk.chunkId);
    merged.push(chunk);
  }

  return merged;
}

function sortByDistance(chunks: SimilarChunk[]): SimilarChunk[] {
  return [...chunks].sort((left, right) => left.distance - right.distance);
}

async function retrieveBaseline(
  prisma: PrismaService,
  embedding: number[],
  corpusIds: string[],
  topK: number,
): Promise<SimilarChunk[]> {
  return searchSimilarChunks(prisma, embedding, topK, { corpusIds });
}

async function retrievePerCorpusQuota(
  prisma: PrismaService,
  embedding: number[],
  corpusIds: string[],
  perCorpusTopK: number,
): Promise<SimilarChunk[]> {
  const parts: SimilarChunk[] = [];

  for (const corpusId of corpusIds) {
    const corpusChunks = await searchSimilarChunks(
      prisma,
      embedding,
      perCorpusTopK,
      { corpusIds: [corpusId] },
    );
    parts.push(...corpusChunks);
  }

  return sortByDistance(dedupeChunks(parts));
}

function chunksFromForensic(
  forensicCase: ForensicMultiCase,
): SimilarChunk[] {
  return forensicCase.retrievalTop20.map((entry, index) => ({
    corpusId: entry.corpusId,
    chunkId: `${entry.corpusId}:${entry.articleNumber}:${index}`,
    articleNumber: entry.articleNumber,
    content: '',
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
    distance: entry.distance ?? index,
  }));
}

function isGoldHit(chunk: SimilarChunk, gold: GoldArticle): boolean {
  return (
    chunk.corpusId === gold.corpusId &&
    chunk.articleNumber === gold.articleNumber
  );
}

function corpusDistribution(chunks: SimilarChunk[]): Record<string, number> {
  const distribution: Record<string, number> = {};
  for (const chunk of chunks) {
    distribution[chunk.corpusId] = (distribution[chunk.corpusId] ?? 0) + 1;
  }
  return distribution;
}

function computeQuestionMetrics(
  question: LegalMulticorpusEvaluationQuestion,
  routedCorpusIds: string[],
  chunks: SimilarChunk[],
): QuestionMetrics {
  const goldRanks = question.goldArticles.map((gold) => {
    const index = chunks.findIndex((chunk) => isGoldHit(chunk, gold));
    return index === -1 ? null : index + 1;
  });
  const goldHits = goldRanks.filter((rank) => rank !== null).length;
  const representedCorpora = new Set(chunks.map((chunk) => chunk.corpusId));
  const corpusRepresented = routedCorpusIds.filter((corpusId) =>
    representedCorpora.has(corpusId),
  ).length;
  const distribution = corpusDistribution(chunks);
  const monopoly =
    routedCorpusIds.length >= 2 &&
    Object.values(distribution).some((count) => count === chunks.length);

  return {
    questionId: question.id,
    routedCorpusIds,
    goldArticles: question.goldArticles,
    candidateCount: chunks.length,
    goldHits,
    goldTotal: question.goldArticles.length,
    corpusRepresented,
    monopoly,
    goldRanks,
  };
}

function percentile(values: number[], pct: number): number | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((pct / 100) * sorted.length) - 1),
  );
  return sorted[index] ?? null;
}

function aggregateStrategy(
  strategy: StrategySpec,
  perQuestion: QuestionMetrics[],
  sqlQueriesPerQuestion: number,
  embeddingsPerQuestion: number,
): StrategyAggregate {
  const goldHits = perQuestion.reduce((sum, row) => sum + row.goldHits, 0);
  const goldTotal = perQuestion.reduce((sum, row) => sum + row.goldTotal, 0);
  const bothCorporaPresentCount = perQuestion.filter(
    (row) => row.corpusRepresented === 2,
  ).length;
  const oneCorpusPresentCount = perQuestion.filter(
    (row) => row.corpusRepresented === 1,
  ).length;
  const zeroCorpusPresentCount = perQuestion.filter(
    (row) => row.corpusRepresented === 0,
  ).length;
  const monopolyCount = perQuestion.filter((row) => row.monopoly).length;
  const foundRanks = perQuestion
    .flatMap((row) => row.goldRanks)
    .filter((rank): rank is number => rank !== null);

  return {
    strategy,
    questionCount: perQuestion.length,
    totalCandidates: strategy.candidateCount,
    articleRecallAtK: goldTotal > 0 ? goldHits / goldTotal : 0,
    goldHits,
    goldTotal,
    bothCorporaPresentPct:
      perQuestion.length > 0
        ? bothCorporaPresentCount / perQuestion.length
        : 0,
    bothCorporaPresentCount,
    oneCorpusPresentCount,
    zeroCorpusPresentCount,
    monopolyRate:
      perQuestion.length > 0 ? monopolyCount / perQuestion.length : 0,
    monopolyCount,
    goldRankMin: foundRanks.length > 0 ? Math.min(...foundRanks) : null,
    goldRankMedian: percentile(foundRanks, 50),
    goldRankP90: percentile(foundRanks, 90),
    sqlQueriesPerQuestion,
    embeddingsPerQuestion,
    perQuestion,
  };
}

async function loadRoutingMap(
  routingRun: string,
): Promise<Map<string, RoutingQuestionResult>> {
  const routingPath = join(
    DEFAULT_MULTICORPUS_RESULTS_DIR,
    routingRun,
    'routing.json',
  );
  const raw = await readFile(routingPath, 'utf-8');
  const parsed = JSON.parse(raw) as RoutingReportFile;
  return new Map(parsed.results.map((result) => [result.questionId, result]));
}

function selectTwoCorpusQuestions(
  questions: LegalMulticorpusEvaluationQuestion[],
  routingById: Map<string, RoutingQuestionResult>,
): LegalMulticorpusEvaluationQuestion[] {
  return questions.filter((question) => {
    const routing = routingById.get(question.id);
    return routing?.predictedCorpusIds.length === 2;
  });
}

async function evaluateCohort(input: {
  label: string;
  questions: LegalMulticorpusEvaluationQuestion[];
  routingById: Map<string, RoutingQuestionResult>;
  prisma: PrismaService;
  openAIService: OpenAIService;
  forensicById?: Map<string, ForensicMultiCase>;
  useForensicBaseline: boolean;
}): Promise<Record<StrategyId, StrategyAggregate>> {
  const perStrategy: Record<StrategyId, QuestionMetrics[]> = {
    baseline_global_20: [],
    quota_10_per_corpus_20: [],
    quota_15_per_corpus_30: [],
  };

  for (const question of input.questions) {
    const routing = input.routingById.get(question.id);
    if (!routing || routing.predictedCorpusIds.length !== 2) {
      continue;
    }

    const corpusIds = [...routing.predictedCorpusIds].sort();
    let embedding: number[] | undefined;

    for (const strategy of STRATEGIES) {
      let chunks: SimilarChunk[];

      if (
        strategy.id === 'baseline_global_20' &&
        input.useForensicBaseline &&
        input.forensicById?.has(question.id)
      ) {
        chunks = chunksFromForensic(input.forensicById.get(question.id)!);
      } else {
        if (!embedding) {
          const embeddingResults = await input.openAIService.createEmbeddings([
            question.question,
          ]);
          embedding = embeddingResults[0]?.embedding;
          if (!embedding) {
            throw new Error(`Missing embedding for ${question.id}`);
          }
        }

        if (strategy.globalTopK) {
          chunks = await retrieveBaseline(
            input.prisma,
            embedding,
            corpusIds,
            strategy.globalTopK,
          );
        } else if (strategy.perCorpusTopK) {
          chunks = await retrievePerCorpusQuota(
            input.prisma,
            embedding,
            corpusIds,
            strategy.perCorpusTopK,
          );
        } else {
          throw new Error(`Unsupported strategy ${strategy.id}`);
        }
      }

      perStrategy[strategy.id].push(
        computeQuestionMetrics(question, corpusIds, chunks),
      );
    }
  }

  return {
    baseline_global_20: aggregateStrategy(
      STRATEGIES[0]!,
      perStrategy.baseline_global_20,
      1,
      input.useForensicBaseline ? 0 : 1,
    ),
    quota_10_per_corpus_20: aggregateStrategy(
      STRATEGIES[1]!,
      perStrategy.quota_10_per_corpus_20,
      2,
      1,
    ),
    quota_15_per_corpus_30: aggregateStrategy(
      STRATEGIES[2]!,
      perStrategy.quota_15_per_corpus_30,
      2,
      1,
    ),
  };
}

function formatPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function printComparisonTable(
  title: string,
  aggregates: Record<StrategyId, StrategyAggregate>,
): void {
  console.log(`\n${title}`);
  console.log(
    '| Stratégie | Candidats | Article recall | 2 corpus présents | Monopole |',
  );
  console.log(
    '| --------- | --------: | -------------: | ----------------: | -------: |',
  );

  for (const strategy of STRATEGIES) {
    const row = aggregates[strategy.id];
    console.log(
      `| ${strategy.label} | ${row.totalCandidates} | ${formatPct(row.articleRecallAtK)} (${row.goldHits}/${row.goldTotal}) | ${formatPct(row.bothCorporaPresentPct)} (${row.bothCorporaPresentCount}/${row.questionCount}) | ${formatPct(row.monopolyRate)} (${row.monopolyCount}/${row.questionCount}) |`,
    );
  }

  for (const strategy of STRATEGIES) {
    const row = aggregates[strategy.id];
    console.log(
      `\n${strategy.label} — rang gold (1-based, hits only): min=${row.goldRankMin ?? 'n/a'}, médiane=${row.goldRankMedian ?? 'n/a'}, p90=${row.goldRankP90 ?? 'n/a'}`,
    );
  }
}

async function main(): Promise<void> {
  const routingRun = '2026-09-19T22-46-46-088Z';
  const diagnosticPath = join(
    DEFAULT_MULTICORPUS_RESULTS_DIR,
    '2026-09-19T23-21-51-901Z',
    'e2e-errors-diagnostic.json',
  );
  const forensicPath = '/tmp/penal-e2e-forensic-output.json';
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputDir = join(
    DEFAULT_MULTICORPUS_RESULTS_DIR,
    `retrieval-quota-replay-${timestamp}`,
  );

  const [allQuestions, diagnosticRaw, forensicRaw, routingById] =
    await Promise.all([
      loadMulticorpusEvaluationDataset(DEFAULT_MULTICORPUS_EVALUATION_DATASET_PATH),
      readFile(diagnosticPath, 'utf-8'),
      readFile(forensicPath, 'utf-8').catch(() => 'null'),
      loadRoutingMap(routingRun),
    ]);

  const diagnostic = JSON.parse(diagnosticRaw) as {
    generation: Array<{ id: string; type: string }>;
  };
  const forensic =
    forensicRaw === 'null'
      ? null
      : (JSON.parse(forensicRaw) as ForensicFile);
  const forensicById = new Map(
    forensic?.multiForensics.map((entry) => [entry.id, entry]) ?? [],
  );

  const errorIds = new Set(
    diagnostic.generation
      .filter((entry) => entry.type === 'multi-corpus')
      .map((entry) => entry.id),
  );
  const allMultiQuestions = allQuestions.filter(
    (question) => question.questionType === 'multi-corpus',
  );
  const errorQuestions = selectTwoCorpusQuestions(
    allMultiQuestions.filter((question) => errorIds.has(question.id)),
    routingById,
  );
  const fullMultiQuestions = selectTwoCorpusQuestions(
    allMultiQuestions,
    routingById,
  );

  const app = await NestFactory.createApplicationContext(RerankingPipelineModule, {
    logger: ['error', 'warn'],
  });

  try {
    const prisma = app.get(PrismaService);
    const openAIService = app.get(OpenAIService);

    const errorAggregates = await evaluateCohort({
      label: '45 erreurs multicorpus',
      questions: errorQuestions,
      routingById,
      prisma,
      openAIService,
      forensicById,
      useForensicBaseline: true,
    });

    const fullAggregates = await evaluateCohort({
      label: '63 multicorpus (57 routées ? 2 corpus)',
      questions: fullMultiQuestions,
      routingById,
      prisma,
      openAIService,
      useForensicBaseline: false,
    });

    printComparisonTable('Cohorte : 45 erreurs multicorpus (2 corpus routés)', errorAggregates);
    printComparisonTable(
      `Cohorte : multicorpus complet (${fullMultiQuestions.length} questions ? 2 corpus routés)`,
      fullAggregates,
    );

    const baseline45 = errorAggregates.baseline_global_20;
    const quota10_45 = errorAggregates.quota_10_per_corpus_20;
    const quota15_45 = errorAggregates.quota_15_per_corpus_30;
    const extraGoldFrom15vs10 =
      quota15_45.goldHits - quota10_45.goldHits;

    console.log('\n## Analyse (45 erreurs)');
    console.log(
      `- Monopoles baseline ? quota10 : ${baseline45.monopolyCount} ? ${quota10_45.monopolyCount}`,
    );
    console.log(
      `- Recall articles baseline ? quota10 ? quota15 : ${baseline45.goldHits}/${baseline45.goldTotal} ? ${quota10_45.goldHits}/${quota10_45.goldTotal} ? ${quota15_45.goldHits}/${quota15_45.goldTotal}`,
    );
    console.log(
      `- Gold supplémentaires quota15 vs quota10 : ${extraGoldFrom15vs10}`,
    );
    console.log(
      `- 2 corpus présents baseline ? quota10 ? quota15 : ${formatPct(baseline45.bothCorporaPresentPct)} ? ${formatPct(quota10_45.bothCorporaPresentPct)} ? ${formatPct(quota15_45.bothCorporaPresentPct)}`,
    );

    await mkdir(outputDir, { recursive: true });
    await writeFile(
      join(outputDir, 'retrieval-quota-replay.json'),
      `${JSON.stringify(
        {
          timestamp,
          routingRun,
          cohorts: {
            errors45: {
              questionCount: errorQuestions.length,
              aggregates: errorAggregates,
            },
            fullMulti: {
              questionCount: fullMultiQuestions.length,
              aggregates: fullAggregates,
            },
          },
        },
        null,
        2,
      )}\n`,
      'utf-8',
    );

    console.log(`\nRapport JSON : ${outputDir}/retrieval-quota-replay.json`);
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
