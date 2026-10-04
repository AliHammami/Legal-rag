import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { NestFactory } from '@nestjs/core';

import { answerQuestion } from '../src/generation/answer-question.js';
import { ROUTING_ABSTENTION_ANSWER } from '../src/generation/constants.js';
import { GenerationPipelineModule } from '../src/generation/generation-pipeline.module.js';
import { RagGenerationService } from '../src/generation/rag-generation.service.js';
import { DEFAULT_MULTICORPUS_EVALUATION_DATASET_PATH } from '../src/evaluation/constants.js';
import { loadMulticorpusEvaluationDataset } from '../src/evaluation/load-multicorpus-dataset.js';
import {
  DEFAULT_MULTICORPUS_RESULTS_DIR,
  buildDefaultModelConfiguration,
} from '../src/evaluation/multicorpus/evaluation-config.js';
import type {
  E2EQuestionResult,
  RoutingQuestionResult,
} from '../src/evaluation/multicorpus/types.js';
import { createPipelineProfiling } from '../src/profiling/pipeline-timings.js';
import { OpenAIService } from '../src/openai/openai.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { JinaRerankerService } from '../src/reranking/jina-reranker.service.js';
import { RerankingPipelineModule } from '../src/reranking/reranking-pipeline.module.js';
import { createJinaEvaluationRerankerService } from '../src/evaluation/multicorpus/jina-concurrency-limit.js';

interface SmokeCliOptions {
  routingRun: string;
  referenceE2ERun: string;
  diagnosticPath: string;
  datasetPath?: string;
  resultsDir: string;
  concurrency: number;
  jinaConcurrency: number;
}

interface RoutingReportFile {
  results: RoutingQuestionResult[];
}

interface AbstentionDiagnosticFile {
  abstention: Array<{ id: string; type: string }>;
}

interface SmokeQuestionResult {
  questionId: string;
  questionType: string;
  cachedPredictedCorpusIds: string[];
  previousRoutingAnswerPreview: string;
  previousAbstentionCorrect: boolean | null;
  answer: string;
  routingDecision: string;
  abstainedViaRouting: boolean;
  pipelineSkipped: boolean;
  profiling: {
    routingCalls: number;
    embeddingCalls: number;
    rerankingCalls: number;
    generationCalls: number;
  };
  pass: boolean;
  failureReason?: string;
}

function parseArgs(argv: string[]): SmokeCliOptions {
  let routingRun = '2026-09-19T22-46-46-088Z';
  let referenceE2ERun = '2026-09-19T23-21-51-901Z';
  let diagnosticPath = join(
    DEFAULT_MULTICORPUS_RESULTS_DIR,
    referenceE2ERun,
    'e2e-errors-diagnostic.json',
  );
  let resultsDir = DEFAULT_MULTICORPUS_RESULTS_DIR;
  let concurrency = 3;
  let jinaConcurrency = 1;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--routing-run' && argv[i + 1]) routingRun = argv[++i];
    else if (arg === '--reference-e2e-run' && argv[i + 1]) {
      referenceE2ERun = argv[++i];
      diagnosticPath = join(
        DEFAULT_MULTICORPUS_RESULTS_DIR,
        referenceE2ERun,
        'e2e-errors-diagnostic.json',
      );
    } else if (arg === '--diagnostic' && argv[i + 1]) diagnosticPath = argv[++i];
    else if (arg === '--results-dir' && argv[i + 1]) resultsDir = argv[++i];
    else if (arg === '--concurrency' && argv[i + 1]) concurrency = Number(argv[++i]);
    else if (arg === '--jina-concurrency' && argv[i + 1]) {
      jinaConcurrency = Number(argv[++i]);
    }
  }

  return {
    routingRun,
    referenceE2ERun,
    diagnosticPath,
    resultsDir,
    concurrency: Math.max(1, concurrency),
    jinaConcurrency: Math.max(1, jinaConcurrency),
  };
}

function resolveRunDirectory(resultsDir: string, runId: string): string {
  return join(resultsDir, runId);
}

function previewAnswer(answer: string, maxLength = 120): string {
  const compact = answer.replace(/\s+/g, ' ').trim();
  return compact.length <= maxLength ? compact : `${compact.slice(0, maxLength)}—`;
}

function evaluateSmokeResult(input: {
  cachedPredictedCorpusIds: string[];
  answer: string;
  routingDecision: string;
  profiling: SmokeQuestionResult['profiling'];
}): { pass: boolean; failureReason?: string; pipelineSkipped: boolean } {
  const pipelineSkipped =
    input.profiling.embeddingCalls === 0 &&
    input.profiling.rerankingCalls === 0 &&
    input.profiling.generationCalls === 0;

  if (input.cachedPredictedCorpusIds.length === 0) {
    if (input.routingDecision !== 'abstain') {
      return {
        pass: false,
        pipelineSkipped,
        failureReason: `expected routing decision abstain, got ${input.routingDecision}`,
      };
    }
    if (input.answer !== ROUTING_ABSTENTION_ANSWER) {
      return {
        pass: false,
        pipelineSkipped,
        failureReason: 'expected routing abstention answer',
      };
    }
    if (!pipelineSkipped) {
      return {
        pass: false,
        pipelineSkipped,
        failureReason: 'expected retrieval/rerank/generation to be skipped',
      };
    }
    return { pass: true, pipelineSkipped };
  }

  return {
    pass: true,
    pipelineSkipped,
    failureReason: undefined,
  };
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputDir = join(options.resultsDir, `abstention-smoke-${timestamp}`);
  const routingRunDir = resolveRunDirectory(options.resultsDir, options.routingRun);
  const referenceE2ERunDir = resolveRunDirectory(
    options.resultsDir,
    options.referenceE2ERun,
  );

  const [diagnosticRaw, routingRaw, referenceE2ERaw, questions] = await Promise.all([
    readFile(options.diagnosticPath, 'utf-8'),
    readFile(join(routingRunDir, 'routing.json'), 'utf-8'),
    readFile(join(referenceE2ERunDir, 'e2e.json'), 'utf-8'),
    loadMulticorpusEvaluationDataset(DEFAULT_MULTICORPUS_EVALUATION_DATASET_PATH),
  ]);

  const diagnostic = JSON.parse(diagnosticRaw) as AbstentionDiagnosticFile;
  const routingReport = JSON.parse(routingRaw) as RoutingReportFile;
  const referenceE2E = JSON.parse(referenceE2ERaw) as { results: E2EQuestionResult[] };

  const targetIds = diagnostic.abstention.map((entry) => entry.id);
  const routingById = new Map(
    routingReport.results.map((result) => [result.questionId, result]),
  );
  const previousE2EById = new Map(
    referenceE2E.results.map((result) => [result.questionId, result]),
  );
  const questionById = new Map(questions.map((question) => [question.id, question]));

  const targetQuestions = targetIds
    .map((id) => questionById.get(id))
    .filter((question): question is NonNullable<typeof question> => question !== undefined);

  if (targetQuestions.length !== targetIds.length) {
    throw new Error(
      `Missing dataset questions for smoke benchmark: expected ${targetIds.length}, found ${targetQuestions.length}`,
    );
  }

  const modelConfiguration = buildDefaultModelConfiguration();
  const rerankApp = await NestFactory.createApplicationContext(RerankingPipelineModule, {
    logger: ['error', 'warn'],
  });
  const generationApp = await NestFactory.createApplicationContext(GenerationPipelineModule, {
    logger: ['error', 'warn'],
  });

  try {
    const prisma = rerankApp.get(PrismaService);
    const openAIService = rerankApp.get(OpenAIService);
    const rerankerService = createJinaEvaluationRerankerService(
      rerankApp.get(JinaRerankerService),
      { concurrencyLimit: options.jinaConcurrency },
    );
    const generationService = generationApp.get(RagGenerationService);

    const results: SmokeQuestionResult[] = new Array(targetQuestions.length);
    let index = 0;
    let completed = 0;

    async function worker(): Promise<void> {
      while (index < targetQuestions.length) {
        const current = index++;
        const question = targetQuestions[current]!;
        const cachedRouting = routingById.get(question.id);
        if (!cachedRouting) {
          throw new Error(`Missing cached routing for ${question.id}`);
        }

        const previous = previousE2EById.get(question.id);
        const profiling = createPipelineProfiling();
        const pipelineResult = await answerQuestion(
          prisma,
          openAIService,
          rerankerService,
          generationService,
          question.question,
          {
            retrievalTopK: modelConfiguration.retrievalTopK,
            rerankTopK: modelConfiguration.rerankTopK,
            relativeScoreThreshold: modelConfiguration.relativeScoreThreshold,
            profiling,
            enableRouting: true,
            routingResultOverride: {
              corpusIds: [...cachedRouting.predictedCorpusIds],
            },
          },
        );

        const routingDecision = pipelineResult.routing?.decision ?? 'unknown';
        const evaluation = evaluateSmokeResult({
          cachedPredictedCorpusIds: cachedRouting.predictedCorpusIds,
          answer: pipelineResult.answer,
          routingDecision,
          profiling: {
            routingCalls: profiling.routingCalls,
            embeddingCalls: profiling.embeddingCalls,
            rerankingCalls: profiling.rerankingCalls,
            generationCalls: profiling.generationCalls,
          },
        });

        results[current] = {
          questionId: question.id,
          questionType: question.questionType,
          cachedPredictedCorpusIds: cachedRouting.predictedCorpusIds,
          previousRoutingAnswerPreview: previewAnswer(previous?.routing.answer ?? ''),
          previousAbstentionCorrect: previous?.routing.judge?.abstentionCorrect ?? null,
          answer: pipelineResult.answer,
          routingDecision,
          abstainedViaRouting: routingDecision === 'abstain',
          pipelineSkipped: evaluation.pipelineSkipped,
          profiling: {
            routingCalls: profiling.routingCalls,
            embeddingCalls: profiling.embeddingCalls,
            rerankingCalls: profiling.rerankingCalls,
            generationCalls: profiling.generationCalls,
          },
          pass: evaluation.pass,
          failureReason: evaluation.failureReason,
        };

        completed += 1;
        console.log(
          `[${completed}/${targetQuestions.length}] ${question.id} routing=${JSON.stringify(cachedRouting.predictedCorpusIds)} pass=${evaluation.pass}`,
        );
      }
    }

    await Promise.all(Array.from({ length: options.concurrency }, () => worker()));

    const emptyRouting = results.filter(
      (result) => result.cachedPredictedCorpusIds.length === 0,
    );
    const nonEmptyRouting = results.filter(
      (result) => result.cachedPredictedCorpusIds.length > 0,
    );
    const passedEmptyRouting = emptyRouting.filter((result) => result.pass);
    const previouslyAnswered = results.filter((result) =>
      result.previousRoutingAnswerPreview.length > 0 &&
      !result.previousRoutingAnswerPreview.startsWith('Le contexte disponible'),
    );

    const summary = {
      timestamp,
      routingRun: options.routingRun,
      referenceE2ERun: options.referenceE2ERun,
      questionCount: results.length,
      cachedEmptyRoutingCount: emptyRouting.length,
      cachedNonEmptyRoutingCount: nonEmptyRouting.length,
      emptyRoutingPassCount: passedEmptyRouting.length,
      emptyRoutingFailCount: emptyRouting.length - passedEmptyRouting.length,
      previouslyGeneratedCount: previouslyAnswered.length,
      nowAbstainedViaRoutingCount: results.filter((result) => result.abstainedViaRouting).length,
      allEmptyRoutingPassed: passedEmptyRouting.length === emptyRouting.length,
    };

    await mkdir(outputDir, { recursive: true });
    await writeFile(
      join(outputDir, 'smoke-abstention.json'),
      `${JSON.stringify({ summary, results }, null, 2)}\n`,
      'utf-8',
    );

    console.log('');
    console.log('Abstention smoke benchmark');
    console.log(`Questions           : ${summary.questionCount}`);
    console.log(`Cached routing []   : ${summary.cachedEmptyRoutingCount}`);
    console.log(`Cached routing >0   : ${summary.cachedNonEmptyRoutingCount}`);
    console.log(`Empty-routing pass  : ${summary.emptyRoutingPassCount}/${summary.cachedEmptyRoutingCount}`);
    console.log(`Now abstained       : ${summary.nowAbstainedViaRoutingCount}`);
    console.log(`Previously answered : ${summary.previouslyGeneratedCount}`);
    console.log(`Output              : ${outputDir}/smoke-abstention.json`);

    if (!summary.allEmptyRoutingPassed) {
      process.exitCode = 1;
    }
  } finally {
    await rerankApp.close();
    await generationApp.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
