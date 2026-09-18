import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { NestFactory } from '@nestjs/core';

import {
  DEFAULT_CORPUS_CHUNKS_PATH,
  DEFAULT_EVALUATION_DATASET_PATH,
  DEFAULT_RAG_FINAL_VALIDATION_PATH,
} from '../src/evaluation/constants.js';
import { runFinalRagValidation } from '../src/evaluation/final-rag-validation.js';
import { formatFinalRagValidationReport } from '../src/evaluation/format-final-rag-validation.js';
import { buildEvaluationSummary } from '../src/evaluation/format-evaluation-report.js';
import {
  loadCorpusArticleNumbers,
} from '../src/evaluation/load-corpus-articles.js';
import {
  loadEvaluationDataset,
  validateGoldArticlesInCorpus,
} from '../src/evaluation/load-evaluation-dataset.js';
import { runRetrievalEvaluation } from '../src/evaluation/run-retrieval-evaluation.js';
import { createPipelineProfiling } from '../src/profiling/pipeline-timings.js';
import {
  DEFAULT_RERANK_TOP_K,
  DEFAULT_RETRIEVAL_TOP_K,
} from '../src/reranking/constants.js';
import { JinaRerankerService } from '../src/reranking/jina-reranker.service.js';
import { RerankingPipelineModule } from '../src/reranking/reranking-pipeline.module.js';
import { searchAndRerankQuestion } from '../src/reranking/search-and-rerank-question.js';
import { OpenAIService } from '../src/openai/openai.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

function runCommand(command: string, args: string[]): boolean {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: false,
  });

  return result.status === 0;
}

async function runRetrievalMetrics() {
  const questions = await loadEvaluationDataset(DEFAULT_EVALUATION_DATASET_PATH);
  const corpusArticleNumbers = await loadCorpusArticleNumbers(
    DEFAULT_CORPUS_CHUNKS_PATH,
  );
  validateGoldArticlesInCorpus(questions, corpusArticleNumbers);

  const app = await NestFactory.createApplicationContext(RerankingPipelineModule, {
    logger: ['error', 'warn'],
  });

  try {
    const prisma = app.get(PrismaService);
    const openAIService = app.get(OpenAIService);
    const rerankerService = app.get(JinaRerankerService);

    const report = await runRetrievalEvaluation(questions, {
      evaluateQuestion: async (question) => {
        const profiling = createPipelineProfiling();
        const result = await searchAndRerankQuestion(
          prisma,
          openAIService,
          rerankerService,
          question.question,
          {
            retrievalTopK: DEFAULT_RETRIEVAL_TOP_K,
            rerankTopK: DEFAULT_RERANK_TOP_K,
            profiling,
            enableRouting: false,
          },
        );

        return { ...result, profiling };
      },
    });

    return buildEvaluationSummary(report.results);
  } finally {
    await app.close();
  }
}

async function main(): Promise<void> {
  const skipProjectChecks = process.argv.includes('--skip-project-checks');
  const skipRetrieval = process.argv.includes('--skip-retrieval');

  const testsPassed = skipProjectChecks
    ? process.argv.includes('--tests-passed')
    : runCommand('pnpm', ['test']);
  const buildPassed = skipProjectChecks
    ? process.argv.includes('--build-passed')
    : runCommand('pnpm', ['build']);

  const retrievalMetrics = skipRetrieval
    ? undefined
    : await runRetrievalMetrics();

  const report = await runFinalRagValidation({
    testsPassed,
    buildPassed,
    retrievalMetrics,
    corpusChunkCount: 0,
  });

  await mkdir(dirname(DEFAULT_RAG_FINAL_VALIDATION_PATH), { recursive: true });
  await writeFile(
    DEFAULT_RAG_FINAL_VALIDATION_PATH,
    `${JSON.stringify(report, null, 2)}\n`,
    'utf-8',
  );

  console.log(formatFinalRagValidationReport(report));
  console.log('');
  console.log('Output:');
  console.log(DEFAULT_RAG_FINAL_VALIDATION_PATH);

  if (report.status === 'FAIL') {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error('');
  console.error('❌ ERREUR FATALE');
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
