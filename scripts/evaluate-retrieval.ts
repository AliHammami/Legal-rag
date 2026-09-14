import { NestFactory } from '@nestjs/core';

import {
  DEFAULT_CORPUS_CHUNKS_PATH,
  DEFAULT_EVALUATION_DATASET_PATH,
} from '../src/evaluation/constants.js';
import {
  findRankingDegradations,
  findRankingImprovements,
  formatRetrievalEvaluationReport,
} from '../src/evaluation/format-evaluation-report.js';
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

async function main(): Promise<void> {
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
          },
        );

        return { ...result, profiling };
      },
    });

    console.log(formatRetrievalEvaluationReport(report));
    console.log('');

    const improvements = findRankingImprovements(report.results);
    const degradations = findRankingDegradations(report.results);

    console.log('RANKING CHANGES');
    console.log(
      `Improved by Jina (${improvements.length}): ${improvements.map((item) => item.question.id).join(', ') || 'none'}`,
    );
    console.log(
      `Degraded by Jina (${degradations.length}): ${degradations.map((item) => item.question.id).join(', ') || 'none'}`,
    );
  } finally {
    await app.close();
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
