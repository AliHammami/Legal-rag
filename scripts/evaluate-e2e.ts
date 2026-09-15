import { NestFactory } from '@nestjs/core';

import { answerQuestion } from '../src/generation/answer-question.js';
import { GenerationPipelineModule } from '../src/generation/generation-pipeline.module.js';
import { RagGenerationService } from '../src/generation/rag-generation.service.js';
import { DEFAULT_RELATIVE_SCORE_THRESHOLD } from '../src/generation/constants.js';
import {
  DEFAULT_E2E_EVALUATION_DATASET_PATH,
  DEFAULT_E2E_EVALUATION_RESULTS_PATH,
} from '../src/evaluation/constants.js';
import { loadE2EEvaluationDataset } from '../src/evaluation/load-e2e-evaluation-dataset.js';
import {
  formatE2EEvaluationSummary,
  runE2EEvaluation,
  summarizeE2EEvaluationReport,
  writeE2EEvaluationReport,
} from '../src/evaluation/run-e2e-evaluation.js';
import { createPipelineProfiling } from '../src/profiling/pipeline-timings.js';
import { JINA_RERANKER_MODEL } from '../src/reranking/constants.js';
import { JinaRerankerService } from '../src/reranking/jina-reranker.service.js';
import { OpenAIService } from '../src/openai/openai.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

async function main(): Promise<void> {
  const questions = await loadE2EEvaluationDataset(
    DEFAULT_E2E_EVALUATION_DATASET_PATH,
  );

  const app = await NestFactory.createApplicationContext(GenerationPipelineModule, {
    logger: ['error', 'warn'],
  });

  try {
    const prisma = app.get(PrismaService);
    const openAIService = app.get(OpenAIService);
    const rerankerService = app.get(JinaRerankerService);
    const generationService = app.get(RagGenerationService);

    const report = await runE2EEvaluation(questions, {
      metadata: {
        dataset: DEFAULT_E2E_EVALUATION_DATASET_PATH,
        questionCount: questions.length,
        generationModel: generationService.getGenerationModel(),
        embeddingModel: openAIService.getEmbeddingModel(),
        rerankerModel: JINA_RERANKER_MODEL,
        contextThreshold: DEFAULT_RELATIVE_SCORE_THRESHOLD,
        createdAt: new Date().toISOString(),
      },
      answerQuestion: async (question) => {
        const profiling = createPipelineProfiling();
        return answerQuestion(
          prisma,
          openAIService,
          rerankerService,
          generationService,
          question.question,
          { profiling },
        );
      },
    });

    await writeE2EEvaluationReport(
      DEFAULT_E2E_EVALUATION_RESULTS_PATH,
      report,
    );

    const summary = summarizeE2EEvaluationReport(
      report,
      DEFAULT_E2E_EVALUATION_RESULTS_PATH,
    );
    console.log(formatE2EEvaluationSummary(summary));

    if (summary.errorCount > 0) {
      console.log('');
      console.log('Failed questions:');
      for (const result of report.results) {
        if (result.status === 'error') {
          console.log(
            `- ${result.id}: ${result.error.code} — ${result.error.message}`,
          );
        }
      }
      process.exitCode = 1;
    }
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
