import { writeFile } from 'node:fs/promises';

import { NestFactory } from '@nestjs/core';

import { DEFAULT_MULTICORPUS_EVALUATION_DATASET_PATH } from '../src/evaluation/constants.js';
import {
  dedupeGeneratedQuestions,
  isValidGeneratedQuestion,
} from '../src/evaluation/filter-generated-multicorpus-questions.js';
import { generateMultiCorpusQuestions } from '../src/evaluation/generate-multicorpus-questions.js';
import { loadMulticorpusCorpusArticleRegistry } from '../src/evaluation/load-corpus-article-index.js';
import { loadMulticorpusEvaluationDataset } from '../src/evaluation/load-multicorpus-dataset.js';
import { sanitizeMulticorpusDatasetQuestion } from '../src/evaluation/sanitize-multicorpus-dataset.js';
import {
  buildMultiCorpusBundles,
} from '../src/evaluation/select-diverse-articles.js';
import { OpenAIService } from '../src/openai/openai.service.js';
import { RoutingPipelineModule } from '../src/routing/routing-pipeline.module.js';

const REPAIR_IDS = ['q356', 'q364', 'q365', 'q366', 'q367'];

async function main(): Promise<void> {
  const questions = await loadMulticorpusEvaluationDataset(
    DEFAULT_MULTICORPUS_EVALUATION_DATASET_PATH,
  );
  const registry = await loadMulticorpusCorpusArticleRegistry();
  const app = await NestFactory.createApplicationContext(RoutingPipelineModule, {
    logger: ['error', 'warn'],
  });

  try {
    const openAIService = app.get(OpenAIService);
    const articlesByCorpus = new Map(
      [...registry.byCorpus.entries()].map(([corpusId, index]) => [
        corpusId,
        [...index.values()],
      ]),
    );
    const bundles = buildMultiCorpusBundles(articlesByCorpus, REPAIR_IDS.length + 5, 2, 2);

    let bundleIndex = 0;
    for (const questionId of REPAIR_IDS) {
      const index = questions.findIndex((question) => question.id === questionId);
      if (index < 0) {
        continue;
      }

      while (bundleIndex < bundles.length) {
        const bundle = bundles[bundleIndex]!;
        bundleIndex += 1;

        const generated = await generateMultiCorpusQuestions(
          openAIService,
          [bundle],
          ['hard'],
        );

        const candidate = dedupeGeneratedQuestions(
          generated.filter((entry) =>
            isValidGeneratedQuestion(entry, registry, {
              expectedQuestionType: 'multi-corpus',
            }),
          ),
        )[0];

        if (!candidate || new Set(candidate.goldCorpusIds).size < 2) {
          continue;
        }

        questions[index] = sanitizeMulticorpusDatasetQuestion({
          ...questions[index]!,
          question: candidate.question.trim(),
          goldCorpusIds: [...new Set(candidate.goldCorpusIds)],
          goldArticles: [...new Set(candidate.goldArticles)],
          referenceAnswer: candidate.referenceAnswer.trim(),
          difficulty: candidate.difficulty,
          questionType: 'multi-corpus',
          sourceArticles: candidate.sourceArticles
            ? [...new Set(candidate.sourceArticles)]
            : [...new Set(candidate.goldArticles)],
        });

        console.log(`Repaired ${questionId}`);
        break;
      }
    }

    await writeFile(
      DEFAULT_MULTICORPUS_EVALUATION_DATASET_PATH,
      `${JSON.stringify(questions, null, 2)}\n`,
      'utf-8',
    );
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
