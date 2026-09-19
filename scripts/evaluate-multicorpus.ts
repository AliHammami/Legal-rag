import { mkdir } from 'node:fs/promises';

import { NestFactory } from '@nestjs/core';

import { RagGenerationService } from '../src/generation/rag-generation.service.js';
import { GenerationPipelineModule } from '../src/generation/generation-pipeline.module.js';
import { E2EJudgeModule } from '../src/evaluation/e2e-judge.module.js';
import { E2EJudgeService } from '../src/evaluation/e2e-judge.service.js';
import { E2ESourceJudgeModule } from '../src/evaluation/e2e-source-judge.module.js';
import { E2ESourceJudgeService } from '../src/evaluation/e2e-source-judge.service.js';
import { loadMulticorpusEvaluationDataset } from '../src/evaluation/load-multicorpus-dataset.js';
import {
  loadCachedPhaseResults,
} from '../src/evaluation/multicorpus/cache.js';
import {
  MULTICORPUS_EVALUATOR_VERSION,
  MULTICORPUS_DATASET_VERSION,
  buildDefaultModelConfiguration,
  parseMulticorpusEvaluationCliOptions,
  resolveMulticorpusRunDirectory,
} from '../src/evaluation/multicorpus/evaluation-config.js';
import type {
  E2EQuestionResult,
  RerankingQuestionResult,
  RetrievalQuestionResult,
  RoutingQuestionResult,
} from '../src/evaluation/multicorpus/types.js';
import { createJinaEvaluationRerankerService } from '../src/evaluation/multicorpus/jina-concurrency-limit.js';
import { buildMulticorpusEvaluationReports } from '../src/evaluation/multicorpus/aggregate-results.js';
import { evaluateE2EQuestions } from '../src/evaluation/multicorpus/e2e-evaluator.js';
import { evaluateRetrievalQuestions } from '../src/evaluation/multicorpus/retrieval-evaluator.js';
import { evaluateRerankingQuestions } from '../src/evaluation/multicorpus/reranking-evaluator.js';
import { evaluateRoutingQuestions } from '../src/evaluation/multicorpus/routing-evaluator.js';
import { formatMulticorpusEvaluationMarkdown } from '../src/evaluation/multicorpus/write-evaluation-report.js';
import { writeMulticorpusEvaluationReports } from '../src/evaluation/multicorpus/write-evaluation-report.js';
import { OpenAIService } from '../src/openai/openai.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { JinaRerankerService } from '../src/reranking/jina-reranker.service.js';
import { RerankingPipelineModule } from '../src/reranking/reranking-pipeline.module.js';

async function main(): Promise<void> {
  const options = parseMulticorpusEvaluationCliOptions(process.argv.slice(2));
  let questions = await loadMulticorpusEvaluationDataset(options.datasetPath);

  if (options.questionId) {
    questions = questions.filter((question) => question.id === options.questionId);
  }
  if (options.limit !== undefined) {
    questions = questions.slice(0, options.limit);
  }

  const { runDir, timestamp, resumed } = await resolveMulticorpusRunDirectory({
    resultsDir: options.resultsDir,
    resume: options.resume,
  });
  if (!resumed) {
    await mkdir(runDir, { recursive: true });
  } else {
    console.log(`Resuming run: ${runDir}`);
  }

  const modelConfiguration = buildDefaultModelConfiguration();
  const metadata = {
    datasetVersion: MULTICORPUS_DATASET_VERSION,
    datasetPath: options.datasetPath,
    timestamp,
    evaluatorVersion: MULTICORPUS_EVALUATOR_VERSION,
    modelConfiguration,
    evaluationConcurrency: options.concurrency,
    jinaConcurrency: options.jinaConcurrency,
    questionCount: questions.length,
    limit: options.limit,
  };

  const rerankApp = await NestFactory.createApplicationContext(RerankingPipelineModule, {
    logger: ['error', 'warn'],
  });
  const generationApp = await NestFactory.createApplicationContext(GenerationPipelineModule, {
    logger: ['error', 'warn'],
  });
  const judgeApp = await NestFactory.createApplicationContext(E2EJudgeModule, {
    logger: ['error', 'warn'],
  });
  const sourceJudgeApp = await NestFactory.createApplicationContext(E2ESourceJudgeModule, {
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
    const judgeService = judgeApp.get(E2EJudgeService);
    const sourceJudgeService = sourceJudgeApp.get(E2ESourceJudgeService);

    const routing = options.modes.has('routing')
      ? await evaluateRoutingQuestions(openAIService, questions, modelConfiguration, {
          runDir,
          force: options.force,
          concurrency: options.concurrency,
        })
      : await loadCachedPhaseResults<RoutingQuestionResult>(
          runDir,
          'routing',
          questions,
          modelConfiguration,
        );

    const retrieval = options.modes.has('retrieval')
      ? await evaluateRetrievalQuestions(
          prisma,
          openAIService,
          questions,
          modelConfiguration,
          {
            runDir,
            force: options.force,
            concurrency: options.concurrency,
          },
        )
      : await loadCachedPhaseResults<RetrievalQuestionResult>(
          runDir,
          'retrieval',
          questions,
          modelConfiguration,
        );

    const reranking = options.modes.has('reranking')
      ? await evaluateRerankingQuestions(
          prisma,
          openAIService,
          rerankerService,
          questions,
          modelConfiguration,
          {
            runDir,
            force: options.force,
            concurrency: options.concurrency,
          },
        )
      : await loadCachedPhaseResults<RerankingQuestionResult>(
          runDir,
          'reranking',
          questions,
          modelConfiguration,
        );

    const e2e = options.modes.has('e2e')
      ? await evaluateE2EQuestions(
          {
            prisma,
            openAIService,
            rerankerService,
            generationService,
            judgeService,
            sourceJudgeService,
          },
          questions,
          modelConfiguration,
          {
            runDir,
            force: options.force,
            concurrency: options.concurrency,
          },
        )
      : await loadCachedPhaseResults<E2EQuestionResult>(
          runDir,
          'e2e',
          questions,
          modelConfiguration,
        );

    const report = buildMulticorpusEvaluationReports({
      metadata,
      questions,
      routing,
      retrieval,
      reranking,
      e2e,
    });

    await writeMulticorpusEvaluationReports(runDir, report);
    console.log(formatMulticorpusEvaluationMarkdown(report));
    console.log('');
    console.log(`Results written to ${runDir}`);
  } finally {
    await rerankApp.close();
    await generationApp.close();
    await judgeApp.close();
    await sourceJudgeApp.close();
  }
}

main().catch((error: unknown) => {
  console.error('');
  console.error('? ERREUR FATALE');
  console.error('');

  if (error instanceof Error) {
    console.error(`Nom : ${error.name}`);
    console.error(`Message : ${error.message}`);
    console.error('');
    console.error('Stack :');
    console.error(error.stack);
  } else {
    console.error(error);
  }

  process.exitCode = 1;
});
