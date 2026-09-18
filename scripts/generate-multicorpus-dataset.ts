import { writeFile } from 'node:fs/promises';

import { NestFactory } from '@nestjs/core';

import { DEFAULT_MULTICORPUS_EVALUATION_DATASET_PATH } from '../src/evaluation/constants.js';
import {
  dedupeGeneratedQuestions,
  isValidGeneratedQuestion,
} from '../src/evaluation/filter-generated-multicorpus-questions.js';
import {
  assignQuestionIds,
  buildDifficultyMix,
  generateMultiCorpusQuestions,
  generateSingleCorpusQuestions,
} from '../src/evaluation/generate-multicorpus-questions.js';
import { loadMulticorpusCorpusArticleRegistry } from '../src/evaluation/load-corpus-article-index.js';
import {
  AMBIGUOUS_SEED_QUESTIONS,
  OUT_OF_SCOPE_SEED_QUESTIONS,
  buildSeedQuestions,
} from '../src/evaluation/multicorpus-seed-questions.js';
import {
  MULTICORPUS_DATASET_QUOTAS,
  MULTICORPUS_DIFFICULTY_TARGETS,
  MULTICORPUS_SINGLE_CORPUS_QUOTAS,
} from '../src/evaluation/multicorpus-dataset.types.js';
import {
  buildMultiCorpusBundles,
  selectDiverseArticles,
} from '../src/evaluation/select-diverse-articles.js';
import { OpenAIService } from '../src/openai/openai.service.js';
import { RoutingPipelineModule } from '../src/routing/routing-pipeline.module.js';
import { finalizeDifficultyDistribution } from '../src/evaluation/finalize-difficulty-distribution.js';
import { sanitizeMulticorpusDataset } from '../src/evaluation/sanitize-multicorpus-dataset.js';
import type { LegalMulticorpusEvaluationQuestion } from '../src/evaluation/multicorpus-dataset.types.js';

const BATCH_SIZE = 5;
const RESERVE_ARTICLE_FACTOR = 1.4;
const MAX_BATCH_ATTEMPTS = 3;

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function generateSingleCorpusSection(
  openAIService: OpenAIService,
  registry: Awaited<ReturnType<typeof loadMulticorpusCorpusArticleRegistry>>,
  usedArticles: Set<string>,
): Promise<LegalMulticorpusEvaluationQuestion[]> {
  const questions: LegalMulticorpusEvaluationQuestion[] = [];

  for (const [corpusId, quota] of Object.entries(MULTICORPUS_SINGLE_CORPUS_QUOTAS)) {
    const articles = [...(registry.byCorpus.get(corpusId)?.values() ?? [])];
    const reserveCount = Math.ceil(quota * RESERVE_ARTICLE_FACTOR);
    const articlePool = selectDiverseArticles(articles, reserveCount, usedArticles);
    const corpusQuestions: LegalMulticorpusEvaluationQuestion[] = [];
    const seenQuestions = new Set<string>();
    let poolIndex = 0;

    while (corpusQuestions.length < quota && poolIndex < articlePool.length) {
      const batch = articlePool.slice(poolIndex, poolIndex + BATCH_SIZE);
      poolIndex += BATCH_SIZE;
      if (batch.length === 0) {
        break;
      }

      const allowedArticles = new Set(batch.map((article) => article.articleNumber));
      let acceptedInBatch = 0;

      for (let attempt = 0; attempt < MAX_BATCH_ATTEMPTS; attempt += 1) {
        const difficultyMix = buildDifficultyMix(batch.length, {
          easy: Math.round((MULTICORPUS_DIFFICULTY_TARGETS.easy / 350) * batch.length),
          medium: Math.round((MULTICORPUS_DIFFICULTY_TARGETS.medium / 350) * batch.length),
          hard: Math.round((MULTICORPUS_DIFFICULTY_TARGETS.hard / 350) * batch.length),
        });

        const generated = await generateSingleCorpusQuestions(
          openAIService,
          corpusId,
          batch,
          difficultyMix,
        );

        const valid = dedupeGeneratedQuestions(
          generated.filter((candidate) => {
            if (
              !isValidGeneratedQuestion(candidate, registry, {
                expectedQuestionType: 'single-corpus',
                expectedCorpusIds: [corpusId],
              })
            ) {
              return false;
            }

            return candidate.goldArticles.every((article) =>
              allowedArticles.has(article),
            );
          }),
        );

        acceptedInBatch = 0;
        for (const candidate of valid) {
          const normalized = candidate.question.trim().toLowerCase();
          if (seenQuestions.has(normalized)) {
            continue;
          }

          seenQuestions.add(normalized);
          for (const article of candidate.goldArticles) {
            usedArticles.add(article);
          }
          corpusQuestions.push({
            id: 'pending',
            question: candidate.question.trim(),
            goldCorpusIds: [corpusId],
            goldArticles: [...candidate.goldArticles],
            referenceAnswer: candidate.referenceAnswer.trim(),
            difficulty: candidate.difficulty,
            questionType: 'single-corpus',
            sourceArticles: candidate.sourceArticles
              ? [...candidate.sourceArticles]
              : [...candidate.goldArticles],
          });
          acceptedInBatch += 1;

          if (corpusQuestions.length >= quota) {
            break;
          }
        }

        if (acceptedInBatch > 0 || corpusQuestions.length >= quota) {
          break;
        }
      }

      console.log(
        `[${corpusId}] ${Math.min(corpusQuestions.length, quota)}/${quota} collected`,
      );
    }

    if (corpusQuestions.length < quota) {
      const extraArticles = selectDiverseArticles(
        articles,
        quota - corpusQuestions.length + 10,
        usedArticles,
      );
      for (const article of extraArticles) {
        if (corpusQuestions.length >= quota) {
          break;
        }

        const generated = await generateSingleCorpusQuestions(
          openAIService,
          corpusId,
          [article],
          ['medium'],
        );

        const candidate = dedupeGeneratedQuestions(
          generated.filter((entry) =>
            isValidGeneratedQuestion(entry, registry, {
              expectedQuestionType: 'single-corpus',
              expectedCorpusIds: [corpusId],
            }),
          ),
        )[0];

        if (!candidate) {
          continue;
        }

        const normalized = candidate.question.trim().toLowerCase();
        if (seenQuestions.has(normalized)) {
          continue;
        }

        seenQuestions.add(normalized);
        usedArticles.add(article.articleNumber);
        corpusQuestions.push({
          id: 'pending',
          question: candidate.question.trim(),
          goldCorpusIds: [corpusId],
          goldArticles: [...candidate.goldArticles],
          referenceAnswer: candidate.referenceAnswer.trim(),
          difficulty: candidate.difficulty,
          questionType: 'single-corpus',
          sourceArticles: candidate.sourceArticles
            ? [...candidate.sourceArticles]
            : [...candidate.goldArticles],
        });
      }
    }

    if (corpusQuestions.length < quota) {
      throw new Error(
        `Unable to generate enough valid single-corpus questions for ${corpusId}: ${corpusQuestions.length}/${quota}`,
      );
    }

    questions.push(...corpusQuestions.slice(0, quota));
  }

  return questions;
}

async function generateMultiCorpusSection(
  openAIService: OpenAIService,
  registry: Awaited<ReturnType<typeof loadMulticorpusCorpusArticleRegistry>>,
): Promise<LegalMulticorpusEvaluationQuestion[]> {
  const articlesByCorpus = new Map(
    [...registry.byCorpus.entries()].map(([corpusId, index]) => [
      corpusId,
      [...index.values()],
    ]),
  );

  const bundles = buildMultiCorpusBundles(
    articlesByCorpus,
    MULTICORPUS_DATASET_QUOTAS.multiCorpus,
  );

  if (bundles.length < MULTICORPUS_DATASET_QUOTAS.multiCorpus) {
    throw new Error(
      `Only ${bundles.length} multi-corpus bundles available, need ${MULTICORPUS_DATASET_QUOTAS.multiCorpus}`,
    );
  }

  const questions: LegalMulticorpusEvaluationQuestion[] = [];
  const bundleBatches = chunk(bundles, BATCH_SIZE);

  const seenQuestions = new Set<string>();

  for (const batch of bundleBatches) {
    const allowedArticles = new Map<string, Set<string>>();
    for (const bundle of batch) {
      for (const entry of bundle) {
        const corpusArticles =
          allowedArticles.get(entry.corpusId) ?? new Set<string>();
        corpusArticles.add(entry.articleNumber);
        allowedArticles.set(entry.corpusId, corpusArticles);
      }
    }

    for (let attempt = 0; attempt < MAX_BATCH_ATTEMPTS; attempt += 1) {
      const difficultyMix = buildDifficultyMix(batch.length, {
        easy: Math.round((MULTICORPUS_DIFFICULTY_TARGETS.easy / 75) * batch.length),
        medium: Math.round((MULTICORPUS_DIFFICULTY_TARGETS.medium / 75) * batch.length),
        hard: Math.round((MULTICORPUS_DIFFICULTY_TARGETS.hard / 75) * batch.length),
      });

      const generated = await generateMultiCorpusQuestions(
        openAIService,
        batch,
        difficultyMix,
      );

      const valid = dedupeGeneratedQuestions(
        generated.filter((candidate) => {
          if (
            !isValidGeneratedQuestion(candidate, registry, {
              expectedQuestionType: 'multi-corpus',
            })
          ) {
            return false;
          }

          return candidate.goldArticles.every((article) =>
            candidate.goldCorpusIds.some((corpusId) =>
              allowedArticles.get(corpusId)?.has(article),
            ),
          );
        }),
      );

      let accepted = 0;
      for (const candidate of valid) {
        const normalized = candidate.question.trim().toLowerCase();
        if (seenQuestions.has(normalized)) {
          continue;
        }

        seenQuestions.add(normalized);
        questions.push({
          id: 'pending',
          question: candidate.question.trim(),
          goldCorpusIds: [...candidate.goldCorpusIds],
          goldArticles: [...candidate.goldArticles],
          referenceAnswer: candidate.referenceAnswer.trim(),
          difficulty: candidate.difficulty,
          questionType: 'multi-corpus',
          sourceArticles: candidate.sourceArticles
            ? [...candidate.sourceArticles]
            : [...candidate.goldArticles],
        });
        accepted += 1;
      }

      if (accepted > 0) {
        break;
      }
    }

    console.log(`[multi-corpus] ${Math.min(questions.length, MULTICORPUS_DATASET_QUOTAS.multiCorpus)}/${MULTICORPUS_DATASET_QUOTAS.multiCorpus} collected`);
  }

  if (questions.length < MULTICORPUS_DATASET_QUOTAS.multiCorpus) {
    const extraBundles = buildMultiCorpusBundles(
      articlesByCorpus,
      MULTICORPUS_DATASET_QUOTAS.multiCorpus - questions.length + 10,
      2,
      2,
    );

    for (const bundle of extraBundles) {
      if (questions.length >= MULTICORPUS_DATASET_QUOTAS.multiCorpus) {
        break;
      }

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

      if (!candidate) {
        continue;
      }

      const normalized = candidate.question.trim().toLowerCase();
      if (seenQuestions.has(normalized)) {
        continue;
      }

      seenQuestions.add(normalized);
      questions.push({
        id: 'pending',
        question: candidate.question.trim(),
        goldCorpusIds: [...candidate.goldCorpusIds],
        goldArticles: [...candidate.goldArticles],
        referenceAnswer: candidate.referenceAnswer.trim(),
        difficulty: candidate.difficulty,
        questionType: 'multi-corpus',
        sourceArticles: candidate.sourceArticles
          ? [...candidate.sourceArticles]
          : [...candidate.goldArticles],
      });

      console.log(
        `[multi-corpus] fallback ${questions.length}/${MULTICORPUS_DATASET_QUOTAS.multiCorpus} collected`,
      );
    }
  }

  if (questions.length < MULTICORPUS_DATASET_QUOTAS.multiCorpus) {
    throw new Error(
      `Unable to generate enough valid multi-corpus questions: ${questions.length}/${MULTICORPUS_DATASET_QUOTAS.multiCorpus}`,
    );
  }

  return questions.slice(0, MULTICORPUS_DATASET_QUOTAS.multiCorpus);
}

function assignAllQuestionIds(
  questions: LegalMulticorpusEvaluationQuestion[],
): LegalMulticorpusEvaluationQuestion[] {
  return assignQuestionIds(
    questions.map(({ id: _id, ...rest }) => rest),
    1,
  );
}

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(RoutingPipelineModule, {
    logger: ['error', 'warn'],
  });

  try {
    const openAIService = app.get(OpenAIService);
    const registry = await loadMulticorpusCorpusArticleRegistry();
    const usedArticles = new Set<string>();

    console.log('Generating single-corpus questions...');
    const singleCorpusQuestions = await generateSingleCorpusSection(
      openAIService,
      registry,
      usedArticles,
    );

    console.log('Generating multi-corpus questions...');
    const multiCorpusQuestions = await generateMultiCorpusSection(
      openAIService,
      registry,
    );

    const ambiguousStartId =
      singleCorpusQuestions.length + multiCorpusQuestions.length + 1;
    const ambiguousQuestions = buildSeedQuestions(
      ambiguousStartId,
      AMBIGUOUS_SEED_QUESTIONS,
    );

    const outOfScopeStartId = ambiguousStartId + ambiguousQuestions.length;
    const outOfScopeQuestions = buildSeedQuestions(
      outOfScopeStartId,
      OUT_OF_SCOPE_SEED_QUESTIONS,
    );

    const dataset = sanitizeMulticorpusDataset(
      finalizeDifficultyDistribution(
        assignAllQuestionIds([
          ...singleCorpusQuestions,
          ...multiCorpusQuestions,
          ...ambiguousQuestions,
          ...outOfScopeQuestions,
        ]),
      ),
    );

    await writeFile(
      DEFAULT_MULTICORPUS_EVALUATION_DATASET_PATH,
      `${JSON.stringify(dataset, null, 2)}\n`,
      'utf-8',
    );

    console.log(
      `Wrote ${dataset.length} questions to ${DEFAULT_MULTICORPUS_EVALUATION_DATASET_PATH}`,
    );
  } finally {
    await app.close();
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
