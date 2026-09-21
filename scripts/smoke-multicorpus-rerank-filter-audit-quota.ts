import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { NestFactory } from '@nestjs/core';

import { DEFAULT_MULTICORPUS_EVALUATION_DATASET_PATH } from '../src/evaluation/constants.js';
import { loadMulticorpusEvaluationDataset } from '../src/evaluation/load-multicorpus-dataset.js';
import {
  DEFAULT_MULTICORPUS_RESULTS_DIR,
  buildDefaultModelConfiguration,
} from '../src/evaluation/multicorpus/evaluation-config.js';
import {
  buildQuestionQuotaAuditRecord,
  buildQuotaAuditReportMarkdown,
  evaluateThresholdGrid,
  pickRepresentativeCases,
  summarizeQuotaAuditRecords,
  type QuestionQuotaAuditRecord,
} from '../src/evaluation/multicorpus/rerank-filter-quota-audit.js';
import type { RoutingQuestionResult } from '../src/evaluation/multicorpus/types.js';
import { createPipelineProfiling } from '../src/profiling/pipeline-timings.js';
import { OpenAIService } from '../src/openai/openai.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { JinaRerankerService } from '../src/reranking/jina-reranker.service.js';
import { searchAndRerankQuestion } from '../src/reranking/search-and-rerank-question.js';
import { RerankingPipelineModule } from '../src/reranking/reranking-pipeline.module.js';
import { createJinaEvaluationRerankerService } from '../src/evaluation/multicorpus/jina-concurrency-limit.js';

interface RoutingReportFile {
  results: RoutingQuestionResult[];
}

interface PreviousSmokeFile {
  perQuestion: Array<{
    questionId: string;
    corpusCoverage: { filter: number };
  }>;
}

interface PartialAuditFile {
  metadata: Record<string, unknown>;
  perQuestion: QuestionQuotaAuditRecord[];
}

const ROUTING_RUN = '2026-09-19T22-46-46-088Z';
const PREVIOUS_SMOKE_PATH = join(
  DEFAULT_MULTICORPUS_RESULTS_DIR,
  'multicorpus-quota-smoke-2026-09-20T23-05-17-065Z',
  'multicorpus-quota-smoke.json',
);
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 3000;

async function loadPreviousSmokeFilterBoth(): Promise<number | null> {
  try {
    const raw = await readFile(PREVIOUS_SMOKE_PATH, 'utf-8');
    const previous = JSON.parse(raw) as PreviousSmokeFile;
    return previous.perQuestion.filter(
      (entry) => entry.corpusCoverage.filter === 2,
    ).length;
  } catch {
    return null;
  }
}

function isTransientError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('Connection terminated') ||
    message.includes('terminating connection') ||
    message.includes('ECONNRESET') ||
    message.includes('ETIMEDOUT')
  );
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetries<T>(operation: () => Promise<T>): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isTransientError(error) || attempt === MAX_RETRIES) {
        throw error;
      }

      console.warn(
        `Transient error (attempt ${attempt}/${MAX_RETRIES}): ${error instanceof Error ? error.message : error}`,
      );
      await sleep(RETRY_DELAY_MS * attempt);
    }
  }

  throw lastError;
}

function parseResumeDir(argv: string[]): string | null {
  const resumeFlagIndex = argv.indexOf('--resume');
  if (resumeFlagIndex >= 0 && argv[resumeFlagIndex + 1]) {
    return argv[resumeFlagIndex + 1]!;
  }

  return null;
}

async function writePartialAudit(
  outputDir: string,
  payload: PartialAuditFile,
): Promise<void> {
  await mkdir(outputDir, { recursive: true });
  await writeFile(
    join(outputDir, 'audit.partial.json'),
    `${JSON.stringify(payload, null, 2)}\n`,
    'utf-8',
  );
}

async function finalizeAudit(
  outputDir: string,
  records: QuestionQuotaAuditRecord[],
  metadataBase: Record<string, unknown>,
  previousFilterBoth: number | null,
): Promise<void> {
  const summary = summarizeQuotaAuditRecords(records);
  const standardGrid = evaluateThresholdGrid(records, undefined, 'standard');
  const minOneCorpusGrid = evaluateThresholdGrid(
    records,
    undefined,
    'minOnePerRoutedCorpus',
  );
  const representativeCases = pickRepresentativeCases(records);

  const auditPayload = {
    metadata: {
      ...metadataBase,
      evaluatedQuestionCount: records.length,
      previousSmokeComparison:
        previousFilterBoth === null
          ? null
          : {
              path: PREVIOUS_SMOKE_PATH,
              previousFilterBothRoutedCorpora: previousFilterBoth,
              currentFilterBothRoutedCorpora: summary.routedCorpus.filterBoth,
              delta: summary.routedCorpus.filterBoth - previousFilterBoth,
            },
    },
    summary,
    thresholdGrid: {
      standard: standardGrid,
      minOnePerRoutedCorpus: minOneCorpusGrid,
    },
    perQuestion: records,
  };

  const reportMarkdown = buildQuotaAuditReportMarkdown({
    summary,
    standardGrid,
    minOneCorpusGrid,
    representativeCases,
    baselineComparison:
      previousFilterBoth === null
        ? undefined
        : {
            previousSmokePath: PREVIOUS_SMOKE_PATH,
            routedFilterBothDelta:
              summary.routedCorpus.filterBoth - previousFilterBoth,
          },
  });

  await mkdir(outputDir, { recursive: true });
  await writeFile(
    join(outputDir, 'audit.json'),
    `${JSON.stringify(auditPayload, null, 2)}\n`,
    'utf-8',
  );
  await writeFile(join(outputDir, 'REPORT.md'), reportMarkdown, 'utf-8');
}

async function main(): Promise<void> {
  const resumeDir = parseResumeDir(process.argv.slice(2));
  const diagnosticPath = join(
    DEFAULT_MULTICORPUS_RESULTS_DIR,
    '2026-09-19T23-21-51-901Z',
    'e2e-errors-diagnostic.json',
  );
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputDir =
    resumeDir ??
    join(
      DEFAULT_MULTICORPUS_RESULTS_DIR,
      `multicorpus-rerank-filter-audit-quota-${timestamp}`,
    );

  const [allQuestions, diagnosticRaw, routingRaw, previousFilterBoth] =
    await Promise.all([
      loadMulticorpusEvaluationDataset(DEFAULT_MULTICORPUS_EVALUATION_DATASET_PATH),
      readFile(diagnosticPath, 'utf-8'),
      readFile(
        join(DEFAULT_MULTICORPUS_RESULTS_DIR, ROUTING_RUN, 'routing.json'),
        'utf-8',
      ),
      loadPreviousSmokeFilterBoth(),
    ]);

  const diagnostic = JSON.parse(diagnosticRaw) as {
    generation: Array<{ id: string; type: string }>;
  };
  const routingReport = JSON.parse(routingRaw) as RoutingReportFile;
  const routingById = new Map(
    routingReport.results.map((result) => [result.questionId, result]),
  );

  const errorIds = diagnostic.generation
    .filter((entry) => entry.type === 'multi-corpus')
    .map((entry) => entry.id);
  const questions = allQuestions.filter((question) => errorIds.includes(question.id));

  let records: QuestionQuotaAuditRecord[] = [];
  let skippedNotTwoCorpus = 0;
  let totalEmbeddingCalls = 0;
  let totalRerankCalls = 0;
  let totalRetrievalMs = 0;
  let totalRerankMs = 0;
  let runTimestamp = timestamp;

  if (resumeDir) {
    const partialPath = join(resumeDir, 'audit.partial.json');
    const completePath = join(resumeDir, 'audit.json');
    const sourcePath = await readFile(partialPath, 'utf-8')
      .then((raw) => ({ path: partialPath, raw }))
      .catch(async () => {
        const raw = await readFile(completePath, 'utf-8');
        return { path: completePath, raw };
      });

    const existing = JSON.parse(sourcePath.raw) as PartialAuditFile;
    records = existing.perQuestion;
    runTimestamp = String(existing.metadata.timestamp ?? timestamp);
    totalEmbeddingCalls = Number(existing.metadata.embeddingCalls ?? 0);
    totalRerankCalls = Number(existing.metadata.jinaCalls ?? 0);
    totalRetrievalMs = Number(existing.metadata.totalRetrievalMs ?? 0);
    totalRerankMs = Number(existing.metadata.totalRerankMs ?? 0);
    skippedNotTwoCorpus = Number(existing.metadata.skippedNotTwoCorpusRouting ?? 0);
    console.log(`Resuming from ${sourcePath.path} (${records.length} questions done)`);
  }

  const completedIds = new Set(records.map((record) => record.questionId));
  const targetQuestions = questions.filter((question) => {
    const routing = routingById.get(question.id);
    return routing && routing.predictedCorpusIds.length === 2;
  });

  if (!resumeDir) {
    skippedNotTwoCorpus = questions.length - targetQuestions.length;
  }

  const modelConfiguration = buildDefaultModelConfiguration();
  const app = await NestFactory.createApplicationContext(RerankingPipelineModule, {
    logger: ['error', 'warn'],
  });

  const metadataBase = {
    timestamp: runTimestamp,
    routingRun: ROUTING_RUN,
    diagnosticRun: '2026-09-19T23-21-51-901Z',
    skippedNotTwoCorpusRouting: skippedNotTwoCorpus,
    filterThreshold: modelConfiguration.relativeScoreThreshold,
    jinaCalls: totalRerankCalls,
    embeddingCalls: totalEmbeddingCalls,
    totalRetrievalMs,
    totalRerankMs,
    averageRetrievalMs: 0,
    averageRerankMs: 0,
  };

  try {
    const prisma = app.get(PrismaService);
    const openAIService = app.get(OpenAIService);
    const rerankerService = createJinaEvaluationRerankerService(
      app.get(JinaRerankerService),
      { concurrencyLimit: 1 },
    );

    for (const question of questions) {
      const routing = routingById.get(question.id);
      if (!routing || routing.predictedCorpusIds.length !== 2) {
        continue;
      }

      if (completedIds.has(question.id)) {
        continue;
      }

      const routedCorpusIds = [...routing.predictedCorpusIds].sort();
      const profiling = createPipelineProfiling();
      const result = await withRetries(() =>
        searchAndRerankQuestion(
          prisma,
          openAIService,
          rerankerService,
          question.question,
          {
            retrievalTopK: modelConfiguration.retrievalTopK,
            rerankTopK: modelConfiguration.rerankTopK,
            profiling,
            enableRouting: true,
            routingResultOverride: {
              corpusIds: routedCorpusIds,
            },
          },
        ),
      );

      const retrieval = result.candidates.map((chunk, index) => ({
        chunkId: chunk.chunkId,
        corpusId: chunk.corpusId,
        articleNumber: chunk.articleNumber,
        retrievalDistance: chunk.distance,
        retrievalRank: index + 1,
      }));

      const rerank = result.reranked.map((chunk, index) => ({
        chunkId: chunk.chunkId,
        corpusId: chunk.corpusId,
        articleNumber: chunk.articleNumber,
        rerankScore: chunk.rerankScore ?? 0,
        rerankRank: index + 1,
      }));

      const record = buildQuestionQuotaAuditRecord({
        questionId: question.id,
        question: question.question,
        routedCorpusIds,
        goldArticles: question.goldArticles,
        retrieval,
        rerank,
        filterThreshold: modelConfiguration.relativeScoreThreshold,
      });

      records.push(record);
      completedIds.add(question.id);
      totalEmbeddingCalls += profiling.embeddingCalls;
      totalRerankCalls += profiling.rerankingCalls;
      totalRetrievalMs += profiling.embeddingMs + profiling.vectorSearchMs;
      totalRerankMs += profiling.jinaRerankingMs;

      metadataBase.jinaCalls = totalRerankCalls;
      metadataBase.embeddingCalls = totalEmbeddingCalls;
      metadataBase.totalRetrievalMs = totalRetrievalMs;
      metadataBase.totalRerankMs = totalRerankMs;

      await writePartialAudit(outputDir, {
        metadata: metadataBase,
        perQuestion: records,
      });

      console.log(
        `[${records.length}/${targetQuestions.length}] ${question.id} routed=${record.classification.byRoutedCorpus} gold=${record.classification.byGoldCorpus} ret=${record.coverage.retrieval.routedCorpusCoverage}/2 rer=${record.coverage.rerank.routedCorpusCoverage}/2 fil=${record.coverage.filter.routedCorpusCoverage}/2 goldArt=${record.coverage.filter.goldArticleHitCount}/${record.goldArticles.length}`,
      );
    }
  } finally {
    await app.close();
  }

  metadataBase.averageRetrievalMs =
    records.length > 0 ? totalRetrievalMs / records.length : 0;
  metadataBase.averageRerankMs =
    records.length > 0 ? totalRerankMs / records.length : 0;

  await finalizeAudit(outputDir, records, metadataBase, previousFilterBoth);

  const summary = summarizeQuotaAuditRecords(records);

  console.log('\nMulticorpus rerank/filter audit quota');
  console.log(`Evaluated           : ${records.length}/${targetQuestions.length}`);
  console.log(`Skipped (!2 corpus) : ${skippedNotTwoCorpus}`);
  console.log(
    `Routed 2 corpus @ filter : ${summary.routedCorpus.filterBoth}/${records.length}`,
  );
  console.log(
    `Gold articles @ filter   : ${summary.goldArticles.filterHits}/${summary.goldArticles.total}`,
  );
  console.log(
    `Classification routed A/B/C : ${summary.classificationByRoutedCorpus.A}/${summary.classificationByRoutedCorpus.B}/${summary.classificationByRoutedCorpus.C}`,
  );
  console.log(`Output               : ${outputDir}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
