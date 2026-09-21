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
  aggregateFinalValidationResults,
  applyFinalValidationFilter,
  buildFinalValidationReportMarkdown,
  buildFilterStageDiagnostics,
  FINAL_VALIDATION_VARIANTS,
  selectFinalValidationCohort,
  type FinalValidationQuestionResult,
  type FinalValidationVariant,
} from '../src/evaluation/multicorpus/filter-final-validation.js';
import {
  goldArticlesInFilteredChunks,
  hydrateRerankedChunksFromAudit,
} from '../src/evaluation/multicorpus/filter-variant-benchmark.js';
import type { QuestionQuotaAuditRecord } from '../src/evaluation/multicorpus/rerank-filter-quota-audit.js';
import { goldCorpusIdsFromArticles } from '../src/evaluation/gold-article.js';
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
class FilterFinalValidationModule {}

const DEFAULT_AUDIT_PATH = join(
  DEFAULT_MULTICORPUS_RESULTS_DIR,
  'multicorpus-rerank-filter-audit-quota-2026-09-21T15-22-47-287Z',
  'audit.json',
);

interface AuditFile {
  perQuestion: QuestionQuotaAuditRecord[];
}

function parseResumeDir(argv: string[]): string | null {
  const index = argv.indexOf('--resume');
  return index >= 0 && argv[index + 1] ? argv[index + 1]! : null;
}

async function main(): Promise<void> {
  const resumeDir = parseResumeDir(process.argv.slice(2));
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputDir =
    resumeDir ??
    join(
      DEFAULT_MULTICORPUS_RESULTS_DIR,
      `multicorpus-filter-final-validation-${timestamp}`,
    );

  const [auditRaw, datasetQuestions] = await Promise.all([
    readFile(DEFAULT_AUDIT_PATH, 'utf-8'),
    loadMulticorpusEvaluationDataset(DEFAULT_MULTICORPUS_EVALUATION_DATASET_PATH),
  ]);

  const audit = JSON.parse(auditRaw) as AuditFile;
  const questionById = new Map(datasetQuestions.map((q) => [q.id, q]));

  let cohort = selectFinalValidationCohort(audit.perQuestion, {
    minSize: 30,
    maxSize: 41,
  });
  let results: FinalValidationQuestionResult[] = [];

  if (resumeDir) {
    const partial = JSON.parse(
      await readFile(join(resumeDir, 'results.partial.json'), 'utf-8'),
    ) as {
      cohort: typeof cohort;
      results: FinalValidationQuestionResult[];
    };
    cohort = partial.cohort;
    results = partial.results;
    console.log(`Resuming ${results.length}/${cohort.questionIds.length}`);
  } else {
    console.log(
      `Cohort: ${cohort.questionIds.length} (A=${cohort.composition.classA} B=${cohort.composition.classB} C=${cohort.composition.classC})`,
    );
  }

  const app = await NestFactory.createApplicationContext(FilterFinalValidationModule, {
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

    for (const questionId of cohort.questionIds) {
      if (completedIds.has(questionId)) {
        continue;
      }

      const record = audit.perQuestion.find((entry) => entry.questionId === questionId);
      const datasetQuestion = questionById.get(questionId);
      if (!record || !datasetQuestion) {
        throw new Error(`Missing data for ${questionId}`);
      }

      console.log(
        `\n=== ${questionId} (${record.classification.byRoutedCorpus}) ===`,
      );
      const rerankedHydrated = await hydrateRerankedChunksFromAudit(prisma, record);
      const variants = {} as FinalValidationQuestionResult['variants'];

      for (const variant of FINAL_VALIDATION_VARIANTS) {
        const filtered = applyFinalValidationFilter(
          rerankedHydrated,
          record.routedCorpusIds,
          variant,
        );
        const { context, sources } = buildRagContext(filtered);
        const generationStart = performance.now();
        const answer = await generationService.generateAnswer({
          question: record.question,
          context,
        });
        const generationMs = performance.now() - generationStart;

        const judge = await judgeService.judgeQuestion({
          questionId,
          question: record.question,
          referenceAnswer: datasetQuestion.referenceAnswer,
          generatedAnswer: answer,
          context,
          expectedAbstention: false,
        });

        const sourceJudge = await sourceJudgeService.judgeSources({
          questionId,
          question: record.question,
          referenceAnswer: datasetQuestion.referenceAnswer,
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

        variants[variant] = {
          variant: variant as FinalValidationVariant,
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
          diagnostics: buildFilterStageDiagnostics(
            record,
            rerankedHydrated,
            filtered,
          ),
        };

        console.log(
          `  ${variant}: chunks=${filtered.length} corp=${variants[variant].diagnostics.filterRoutedCorpusCount}/2 goldCorp=${variants[variant].diagnostics.allGoldCorporaPresent} corr=${judge.correctness} comp=${judge.completeness} gr=${judge.groundedness}`,
        );
      }

      const questionResult: FinalValidationQuestionResult = {
        questionId,
        question: record.question,
        classification: record.classification,
        routedCorpusIds: record.routedCorpusIds,
        goldArticles: record.goldArticles,
        goldCorpusIds: goldCorpusIdsFromArticles(record.goldArticles),
        variants,
      };

      results.push(questionResult);
      completedIds.add(questionId);

      await mkdir(outputDir, { recursive: true });
      await writeFile(
        join(outputDir, 'results.partial.json'),
        `${JSON.stringify({ metadata: { timestamp, generationModel, judgeModel }, cohort, results }, null, 2)}\n`,
        'utf-8',
      );
    }

    const aggregates = aggregateFinalValidationResults(results);
    const payload = {
      metadata: {
        timestamp,
        auditSourcePath: DEFAULT_AUDIT_PATH,
        generationModel,
        judgeModel,
        cohort,
        variantDefinitions: {
          'A_baseline_0.40': 'dynamicContextFilter threshold 0.40',
          'B_conditional_min1_0.40':
            'if corpusIds.length > 1: min 1 chunk per routed corpus then threshold 0.40; else threshold 0.40',
        },
      },
      aggregates,
      results,
    };

    const perQuestion = results.map((result) => ({
      questionId: result.questionId,
      classification: result.classification,
      goldCorpusIds: result.goldCorpusIds,
      goldArticles: result.goldArticles,
      variants: Object.fromEntries(
        FINAL_VALIDATION_VARIANTS.map((variant) => [
          variant,
          {
            diagnostics: result.variants[variant].diagnostics,
            contextChunkCount: result.variants[variant].contextChunkCount,
            goldArticleHits: result.variants[variant].goldArticleHits,
            judge: result.variants[variant].judge,
            sourceJudge: result.variants[variant].sourceJudge,
            answer: result.variants[variant].answer,
          },
        ]),
      ),
    }));

    const reportMarkdown = buildFinalValidationReportMarkdown({
      cohort,
      aggregates,
      results,
      auditSourcePath: DEFAULT_AUDIT_PATH,
      generationModel,
      judgeModel,
    });

    await mkdir(outputDir, { recursive: true });
    await writeFile(
      join(outputDir, 'results.json'),
      `${JSON.stringify(payload, null, 2)}\n`,
      'utf-8',
    );
    await writeFile(
      join(outputDir, 'per-question.json'),
      `${JSON.stringify(perQuestion, null, 2)}\n`,
      'utf-8',
    );
    await writeFile(join(outputDir, 'REPORT.md'), reportMarkdown, 'utf-8');

    console.log('\nFinal validation complete');
    for (const row of aggregates) {
      console.log(
        `${row.label} | corr=${row.avgCorrectness.toFixed(2)} comp=${row.avgCompleteness.toFixed(2)} gr=${row.avgGroundedness.toFixed(2)} goldCorp=${row.allGoldCorporaPresentCount}/${row.questionCount} goldRecall=${(row.goldArticleRecall * 100).toFixed(1)}% chunks=${row.avgContextChunks.toFixed(2)}`,
      );
    }
    console.log(`Output: ${outputDir}`);
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
