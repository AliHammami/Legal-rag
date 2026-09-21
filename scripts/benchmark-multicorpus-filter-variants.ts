import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';

import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';

import { DEFAULT_MULTICORPUS_EVALUATION_DATASET_PATH } from '../src/evaluation/constants.js';
import { E2EJudgeModule } from '../src/evaluation/e2e-judge.module.js';
import { E2ESourceJudgeModule } from '../src/evaluation/e2e-source-judge.module.js';
import { loadMulticorpusEvaluationDataset } from '../src/evaluation/load-multicorpus-dataset.js';
import {
  aggregateFilterBenchmarkResults,
  applyFilterVariant,
  buildFilterBenchmarkReportMarkdown,
  FILTER_BENCHMARK_VARIANTS,
  goldArticlesInFilteredChunks,
  hydrateRerankedChunksFromAudit,
  selectFilterBenchmarkCohort,
  type FilterBenchmarkQuestionResult,
  type FilterBenchmarkVariant,
  type FilterVariantRunResult,
} from '../src/evaluation/multicorpus/filter-variant-benchmark.js';
import type { QuestionQuotaAuditRecord } from '../src/evaluation/multicorpus/rerank-filter-quota-audit.js';
import { DEFAULT_MULTICORPUS_RESULTS_DIR } from '../src/evaluation/multicorpus/evaluation-config.js';
import { buildRagContext } from '../src/generation/build-rag-context.js';
import { GenerationPipelineModule } from '../src/generation/generation-pipeline.module.js';
import { RagGenerationService } from '../src/generation/rag-generation.service.js';
import { E2EJudgeService } from '../src/evaluation/e2e-judge.service.js';
import { E2ESourceJudgeService } from '../src/evaluation/e2e-source-judge.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    GenerationPipelineModule,
    E2EJudgeModule,
    E2ESourceJudgeModule,
  ],
})
class FilterBenchmarkModule {}

const DEFAULT_AUDIT_PATH = join(
  DEFAULT_MULTICORPUS_RESULTS_DIR,
  'multicorpus-rerank-filter-audit-quota-2026-09-21T15-22-47-287Z',
  'audit.json',
);

interface AuditFile {
  perQuestion: QuestionQuotaAuditRecord[];
}

interface PartialResultsFile {
  metadata: Record<string, unknown>;
  cohortQuestionIds: string[];
  cohortRationale: Record<string, string>;
  results: FilterBenchmarkQuestionResult[];
}

function parseResumeDir(argv: string[]): string | null {
  const index = argv.indexOf('--resume');
  return index >= 0 && argv[index + 1] ? argv[index + 1]! : null;
}

async function runVariant(
  variant: FilterBenchmarkVariant,
  record: QuestionQuotaAuditRecord,
  rerankedHydrated: Awaited<ReturnType<typeof hydrateRerankedChunksFromAudit>>,
  deps: {
    generationService: RagGenerationService;
    judgeService: E2EJudgeService;
    sourceJudgeService: E2ESourceJudgeService;
    referenceAnswer: string;
  },
): Promise<FilterVariantRunResult> {
  const filtered = applyFilterVariant(
    rerankedHydrated,
    record.routedCorpusIds,
    variant,
  );
  const { context, sources } = buildRagContext(filtered);
  const generationStart = performance.now();
  const answer = await deps.generationService.generateAnswer({
    question: record.question,
    context,
  });
  const generationMs = performance.now() - generationStart;

  const judge = await deps.judgeService.judgeQuestion({
    questionId: record.questionId,
    question: record.question,
    referenceAnswer: deps.referenceAnswer,
    generatedAnswer: answer,
    context,
    expectedAbstention: false,
  });

  const sourceJudge = await deps.sourceJudgeService.judgeSources({
    questionId: record.questionId,
    question: record.question,
    referenceAnswer: deps.referenceAnswer,
    generatedAnswer: answer,
    expectedAbstention: false,
    sources: sources.map((source) => ({
      sourceId: source.sourceId,
      chunkId: source.chunkId,
      articleNumber: source.articleNumber,
      content: source.content,
    })),
    judgeResult: judge,
  });

  return {
    variant,
    filteredChunks: filtered.map((chunk) => ({
      chunkId: chunk.chunkId,
      corpusId: chunk.corpusId,
      articleNumber: chunk.articleNumber,
      rerankScore: chunk.rerankScore ?? 0,
    })),
    corpusIds: [...new Set(filtered.map((chunk) => chunk.corpusId))].sort(),
    articleNumbers: filtered.map((chunk) => chunk.articleNumber),
    goldArticleHits: goldArticlesInFilteredChunks(filtered, record.goldArticles),
    contextChunkCount: filtered.length,
    answer,
    sources: sources.map((source) => ({
      sourceId: source.sourceId,
      chunkId: source.chunkId,
      corpusId: source.chunk.corpusId,
      articleNumber: source.articleNumber,
    })),
    generationMs,
    judge,
    sourceJudge,
  };
}

async function main(): Promise<void> {
  const resumeDir = parseResumeDir(process.argv.slice(2));
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputDir =
    resumeDir ??
    join(
      DEFAULT_MULTICORPUS_RESULTS_DIR,
      `multicorpus-filter-variant-benchmark-${timestamp}`,
    );

  const auditPath = DEFAULT_AUDIT_PATH;
  const [auditRaw, datasetQuestions] = await Promise.all([
    readFile(auditPath, 'utf-8'),
    loadMulticorpusEvaluationDataset(DEFAULT_MULTICORPUS_EVALUATION_DATASET_PATH),
  ]);

  const audit = JSON.parse(auditRaw) as AuditFile;
  const questionById = new Map(datasetQuestions.map((question) => [question.id, question]));

  let cohortQuestionIds: string[];
  let cohortRationale: Record<string, string>;
  let results: FilterBenchmarkQuestionResult[] = [];

  if (resumeDir) {
    const partial = JSON.parse(
      await readFile(join(resumeDir, 'results.partial.json'), 'utf-8'),
    ) as PartialResultsFile;
    cohortQuestionIds = partial.cohortQuestionIds;
    cohortRationale = partial.cohortRationale;
    results = partial.results;
    console.log(`Resuming ${results.length}/${cohortQuestionIds.length} questions`);
  } else {
    const cohort = selectFilterBenchmarkCohort(audit.perQuestion, 15);
    cohortQuestionIds = cohort.questionIds;
    cohortRationale = cohort.rationale;
    console.log('Selected cohort:', cohortQuestionIds.join(', '));
  }

  const app = await NestFactory.createApplicationContext(FilterBenchmarkModule, {
    logger: ['error', 'warn'],
  });

  try {
    const prisma = app.get(PrismaService);
    const generationService = app.get(RagGenerationService);
    const judgeService = app.get(E2EJudgeService);
    const sourceJudgeService = app.get(E2ESourceJudgeService);
    const generationModel = generationService.getGenerationModel();
    const judgeModel = judgeService.getJudgeModel();

    const completedIds = new Set(results.map((result) => result.questionId));

    for (const questionId of cohortQuestionIds) {
      if (completedIds.has(questionId)) {
        continue;
      }

      const record = audit.perQuestion.find((entry) => entry.questionId === questionId);
      const datasetQuestion = questionById.get(questionId);
      if (!record || !datasetQuestion) {
        throw new Error(`Missing audit/dataset entry for ${questionId}`);
      }

      console.log(`\n=== ${questionId} (${record.classification.byRoutedCorpus}) ===`);
      const rerankedHydrated = await hydrateRerankedChunksFromAudit(prisma, record);

      const variants = {} as FilterBenchmarkQuestionResult['variants'];
      for (const variant of FILTER_BENCHMARK_VARIANTS) {
        console.log(`  -> ${variant}`);
        variants[variant] = await runVariant(variant, record, rerankedHydrated, {
          generationService,
          judgeService,
          sourceJudgeService,
          referenceAnswer: datasetQuestion.referenceAnswer,
        });
        console.log(
          `     chunks=${variants[variant].contextChunkCount} corp=${variants[variant].corpusIds.join('+')} corr=${variants[variant].judge?.correctness} comp=${variants[variant].judge?.completeness} gr=${variants[variant].judge?.groundedness}`,
        );
      }

      const questionResult: FilterBenchmarkQuestionResult = {
        questionId,
        question: record.question,
        classification: record.classification,
        routedCorpusIds: record.routedCorpusIds,
        goldArticles: record.goldArticles,
        variants,
      };

      results.push(questionResult);
      completedIds.add(questionId);

      await mkdir(outputDir, { recursive: true });
      await writeFile(
        join(outputDir, 'results.partial.json'),
        `${JSON.stringify(
          {
            metadata: {
              timestamp,
              auditSourcePath: auditPath,
              generationModel,
              judgeModel,
            },
            cohortQuestionIds,
            cohortRationale,
            results,
          },
          null,
          2,
        )}\n`,
        'utf-8',
      );
    }

    const aggregates = aggregateFilterBenchmarkResults(results);
    const payload = {
      metadata: {
        timestamp,
        auditSourcePath: auditPath,
        generationModel,
        judgeModel,
        cohortQuestionIds,
        cohortRationale,
        variantDefinitions: {
          'A_baseline_0.40': 'dynamicContextFilter threshold 0.40',
          'B_threshold_0.25': 'dynamicContextFilter threshold 0.25',
          'C_min1_corpus_0.40':
            'threshold 0.40 + min 1 chunk per routed corpus (benchmark-only)',
        },
      },
      aggregates,
      results,
    };

    const reportMarkdown = buildFilterBenchmarkReportMarkdown({
      cohortQuestionIds,
      cohortRationale,
      auditSourcePath: auditPath,
      aggregates,
      results,
      judgeModel,
      generationModel,
    });

    await mkdir(outputDir, { recursive: true });
    await writeFile(
      join(outputDir, 'results.json'),
      `${JSON.stringify(payload, null, 2)}\n`,
      'utf-8',
    );
    await writeFile(join(outputDir, 'REPORT.md'), reportMarkdown, 'utf-8');

    console.log('\nFilter variant benchmark complete');
    console.log(`Questions : ${results.length}`);
    for (const row of aggregates) {
      console.log(
        `${row.label} | corr=${row.avgCorrectness.toFixed(2)} comp=${row.avgCompleteness.toFixed(2)} gr=${row.avgGroundedness.toFixed(2)} srcCov=${row.avgSourceCoverage.toFixed(2)} chunks=${row.avgContextChunks.toFixed(2)}`,
      );
    }
    console.log(`Output : ${outputDir}`);
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
