import { NestFactory } from '@nestjs/core';

import { analyzeQuestionRerankScores } from '../src/evaluation/analyze-reranker-scores.js';
import { buildThresholdSensitivityReport } from '../src/evaluation/analyze-reranker-threshold-sensitivity.js';
import {
  DEFAULT_CORPUS_CHUNKS_PATH,
  DEFAULT_EVALUATION_DATASET_PATH,
} from '../src/evaluation/constants.js';
import { formatThresholdSensitivityReport } from '../src/evaluation/format-reranker-threshold-sensitivity-report.js';
import { loadCorpusArticleNumbers } from '../src/evaluation/load-corpus-articles.js';
import {
  loadEvaluationDataset,
  validateGoldArticlesInCorpus,
} from '../src/evaluation/load-evaluation-dataset.js';
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
    const analyses = [];

    for (const question of questions) {
      const profiling = createPipelineProfiling();
      const { reranked } = await searchAndRerankQuestion(
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

      analyses.push(analyzeQuestionRerankScores(question, reranked));
    }

    const report = buildThresholdSensitivityReport(analyses);
    console.log(formatThresholdSensitivityReport(report));
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
