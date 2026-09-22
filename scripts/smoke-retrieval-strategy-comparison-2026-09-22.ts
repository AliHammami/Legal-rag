import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { NestFactory } from '@nestjs/core';

import { GenerationPipelineModule } from '../src/generation/generation-pipeline.module.js';
import { RagGenerationService } from '../src/generation/rag-generation.service.js';
import { DEFAULT_MULTICORPUS_EVALUATION_DATASET_PATH } from '../src/evaluation/constants.js';
import { E2EJudgeModule } from '../src/evaluation/e2e-judge.module.js';
import { E2EJudgeService } from '../src/evaluation/e2e-judge.service.js';
import { E2ESourceJudgeModule } from '../src/evaluation/e2e-source-judge.module.js';
import { E2ESourceJudgeService } from '../src/evaluation/e2e-source-judge.service.js';
import { loadMulticorpusEvaluationDataset } from '../src/evaluation/load-multicorpus-dataset.js';
import { buildDefaultModelConfiguration } from '../src/evaluation/multicorpus/evaluation-config.js';
import { createJinaEvaluationRerankerService } from '../src/evaluation/multicorpus/jina-concurrency-limit.js';
import {
  aggregateMiniRegressionSummary,
  classifyHybridMiniRegressionDecision,
  compareQuestionVariants,
  judgeSnapshotFromTop30,
  unionVariantFromArtifacts,
  vectorVariantFromTop30Smoke,
  type MiniRegressionQuestionBenchmark,
} from '../src/evaluation/multicorpus/retrieval-hybrid-mini-regression-report.js';
import { loadQuestionEmbeddingCache } from '../src/evaluation/multicorpus/retrieval-depth-local-replay.js';
import {
  runRetrievalTop30SmokeQuestion,
  type RetrievalTop30SmokeQuestionResult,
} from '../src/evaluation/multicorpus/retrieval-top30-smoke-pipeline.js';
import type { RetrievalStrategy } from '../src/retrieval/retrieval-strategy.js';
import { OpenAIService } from '../src/openai/openai.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { DEFAULT_RERANK_TOP_K } from '../src/reranking/constants.js';
import { JinaRerankerService } from '../src/reranking/jina-reranker.service.js';
import { RerankingPipelineModule } from '../src/reranking/reranking-pipeline.module.js';

const COHORT_SELECTION = join(
  'reports/evaluation/runs',
  'retrieval-hybrid-mini-regression-2026-09-22',
  'selection.json',
);
const TOP30_CACHE = join(
  'reports/evaluation/runs',
  'retrieval-top30-smoke-2026-09-22',
  'e2e-cache',
);
const EMBEDDING_CACHE = join(
  'reports/evaluation/runs',
  'retrieval-depth-benchmark-2026-09-22',
  'embedding-cache.json',
);
const HYBRID_PER_QUESTION = join(
  'reports/evaluation/runs',
  'retrieval-hybrid-benchmark-2026-09-22',
  'per-question.json',
);
const OUTPUT_DIR = join(
  'reports/evaluation/runs',
  'retrieval-strategy-smoke-2026-09-22',
);

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function smokeToUnionVariant(
  result: RetrievalTop30SmokeQuestionResult,
  meta: {
    goldArticles: Array<{ corpusId: string; articleNumber: string }>;
    goldCorpusIds: string[];
    questionType: string;
  },
) {
  return unionVariantFromArtifacts({
    unionCandidates: result.retrieval.map((row, index) => ({
      rank: index + 1,
      chunkId: row.chunkId,
      corpusId: row.corpusId,
      articleNumber: row.articleNumber,
      distance: row.distance,
    })),
    smokeUnion: {
      variant: 'union',
      candidateCount: result.retrieval.length,
      retrieval: {
        goldHits: 0,
        goldTotal: meta.goldArticles.length,
        goldRecall: 0,
        fullCoverage: false,
        corpusCoverage: null,
        corpusTotal: null,
        chunkCount: result.retrieval.length,
      },
      afterJina: {
        goldHits: 0,
        goldTotal: meta.goldArticles.length,
        goldRecall: 0,
        fullCoverage: false,
        corpusCoverage: null,
        corpusTotal: null,
        chunkCount: result.reranking.length,
      },
      afterFilter: {
        goldHits: result.metrics.finalContextGoldHits.length,
        goldTotal: meta.goldArticles.length,
        goldRecall:
          meta.goldArticles.length > 0
            ? result.metrics.finalContextGoldHits.length / meta.goldArticles.length
            : 0,
        fullCoverage: result.metrics.finalContextFullCoverage,
        corpusCoverage: null,
        corpusTotal: null,
        chunkCount: result.filter.finalChunkIds.length,
      },
      jinaTop5: result.reranking.map((row) => ({
        rank: row.rank,
        chunkId: row.chunkId,
        corpusId: row.corpusId,
        articleNumber: row.articleNumber,
        score: row.score,
      })),
      filterRows: result.filter.rows.map((row) => ({
        chunkId: row.chunkId,
        corpusId: row.corpusId,
        articleNumber: row.articleNumber,
        rerankScore: row.rerankScore,
        kept: row.kept,
      })),
      finalContextChunkIds: result.filter.finalChunkIds,
    },
    goldArticles: meta.goldArticles,
    goldCorpusIds: meta.goldCorpusIds,
    questionType: meta.questionType,
    answer: result.generation.answer,
    judge: judgeSnapshotFromTop30(result),
  });
}

async function loadOrRunStrategySmoke(input: {
  strategy: RetrievalStrategy;
  questionId: string;
  cachePath: string;
  run: () => Promise<RetrievalTop30SmokeQuestionResult>;
  onApi: (result: RetrievalTop30SmokeQuestionResult) => void;
}): Promise<RetrievalTop30SmokeQuestionResult> {
  if (await fileExists(input.cachePath)) {
    return JSON.parse(
      await readFile(input.cachePath, 'utf-8'),
    ) as RetrievalTop30SmokeQuestionResult;
  }
  const result = await input.run();
  input.onApi(result);
  await writeFile(input.cachePath, `${JSON.stringify(result, null, 2)}\n`);
  return result;
}

async function main(): Promise<void> {
  const selection = JSON.parse(await readFile(COHORT_SELECTION, 'utf-8')) as {
    questionIds: string[];
  };
  const hybridMeta = JSON.parse(await readFile(HYBRID_PER_QUESTION, 'utf-8')) as Array<{
    questionId: string;
    questionType: string;
    goldArticles: Array<{ corpusId: string; articleNumber: string }>;
    goldCorpusIds: string[];
    routedCorpusIds: string[];
  }>;
  const metaById = new Map(hybridMeta.map((row) => [row.questionId, row]));
  const datasetQuestions = await loadMulticorpusEvaluationDataset(
    DEFAULT_MULTICORPUS_EVALUATION_DATASET_PATH,
  );
  const datasetById = new Map(datasetQuestions.map((q) => [q.id, q]));
  const embeddingCache = await loadQuestionEmbeddingCache(EMBEDDING_CACHE);

  await mkdir(join(OUTPUT_DIR, 'cache', 'vector'), { recursive: true });
  await mkdir(join(OUTPUT_DIR, 'cache', 'hybrid-union'), { recursive: true });

  const apiCalls = {
    embedding: 0,
    jina: 0,
    generation: 0,
    judge: 0,
    sourceJudge: 0,
    routing: 0,
    openai: 0,
    productionModified: 'NO' as const,
  };

  const app = await NestFactory.createApplicationContext(RerankingPipelineModule, {
    logger: ['error', 'warn'],
  });
  const generationApp = await NestFactory.createApplicationContext(
    GenerationPipelineModule,
    { logger: ['error', 'warn'] },
  );
  const judgeApp = await NestFactory.createApplicationContext(E2EJudgeModule, {
    logger: ['error', 'warn'],
  });
  const sourceJudgeApp = await NestFactory.createApplicationContext(
    E2ESourceJudgeModule,
    { logger: ['error', 'warn'] },
  );

  const paired: MiniRegressionQuestionBenchmark[] = [];

  try {
    const prisma = app.get(PrismaService);
    const openAIService = app.get(OpenAIService);
    const rerankerService = createJinaEvaluationRerankerService(
      app.get(JinaRerankerService),
      { concurrencyLimit: 1 },
    );
    const generationService = generationApp.get(RagGenerationService);
    const judgeService = judgeApp.get(E2EJudgeService);
    const sourceJudgeService = sourceJudgeApp.get(E2ESourceJudgeService);
    const config = buildDefaultModelConfiguration();

    const trackApi = (result: RetrievalTop30SmokeQuestionResult): void => {
      apiCalls.embedding += result.embeddingFromCache ? 0 : 1;
      apiCalls.jina += result.profiling.rerankingCalls;
      apiCalls.generation += result.profiling.generationCalls;
      apiCalls.judge += 1;
      apiCalls.sourceJudge += 1;
      apiCalls.openai +=
        (result.embeddingFromCache ? 0 : 1) +
        result.profiling.generationCalls +
        2;
    };

    for (const questionId of selection.questionIds) {
      const meta = metaById.get(questionId);
      const datasetQuestion = datasetById.get(questionId);
      if (!meta || !datasetQuestion) {
        throw new Error(`Missing meta for ${questionId}`);
      }

      const vectorCache = join(OUTPUT_DIR, 'cache', 'vector', `${questionId}.json`);
      const vectorResult = await (async () => {
        const top30Path = join(TOP30_CACHE, `${questionId}.json`);
        if (await fileExists(top30Path)) {
          return JSON.parse(
            await readFile(top30Path, 'utf-8'),
          ) as RetrievalTop30SmokeQuestionResult;
        }
        return loadOrRunStrategySmoke({
          strategy: 'vector',
          questionId,
          cachePath: vectorCache,
          onApi: trackApi,
          run: () =>
            runRetrievalTop30SmokeQuestion({
              prisma,
              openAIService,
              rerankerService,
              generationService,
              judgeService,
              sourceJudgeService,
              question: datasetQuestion,
              config: {
                retrievalTopK: 30,
                rerankTopK: DEFAULT_RERANK_TOP_K,
                relativeScoreThreshold: config.relativeScoreThreshold,
                routingModel: config.routingModel,
                retrievalStrategy: 'vector',
              },
              routedCorpusIds: meta.routedCorpusIds,
              cachedEmbedding: embeddingCache.embeddings[questionId],
            }),
        });
      })();

      const hybridCache = join(
        OUTPUT_DIR,
        'cache',
        'hybrid-union',
        `${questionId}.json`,
      );
      const hybridResult = await loadOrRunStrategySmoke({
        strategy: 'hybrid-union',
        questionId,
        cachePath: hybridCache,
        onApi: trackApi,
        run: () =>
          runRetrievalTop30SmokeQuestion({
            prisma,
            openAIService,
            rerankerService,
            generationService,
            judgeService,
            sourceJudgeService,
            question: datasetQuestion,
            config: {
              retrievalTopK: 30,
              rerankTopK: DEFAULT_RERANK_TOP_K,
              relativeScoreThreshold: config.relativeScoreThreshold,
              routingModel: config.routingModel,
              retrievalStrategy: 'hybrid-union',
            },
            routedCorpusIds: meta.routedCorpusIds,
            cachedEmbedding: embeddingCache.embeddings[questionId],
          }),
      });

      const vectorVariant = vectorVariantFromTop30Smoke({ result: vectorResult });
      const hybridVariant = smokeToUnionVariant(hybridResult, meta);

      paired.push({
        questionId,
        question: vectorResult.question,
        questionType: meta.questionType,
        goldArticles: meta.goldArticles,
        routing: vectorResult.routing,
        vector: vectorVariant,
        union: hybridVariant,
        comparison: compareQuestionVariants({
          vector: vectorVariant,
          union: hybridVariant,
          goldArticles: meta.goldArticles,
        }),
      });
      console.log(`Paired ${questionId}`);
    }

    const summary = aggregateMiniRegressionSummary(paired);
    const decision = classifyHybridMiniRegressionDecision({
      cohortSize: paired.length,
      summary,
    });

    await writeFile(
      join(OUTPUT_DIR, 'summary.json'),
      `${JSON.stringify({ metadata: { apiCalls, cohortSize: paired.length }, summary, decision, perQuestion: paired }, null, 2)}\n`,
    );

    console.log('\n=== Strategy smoke ===');
    console.log(
      `Correctness: ${summary.vector.correctness.toFixed(2)} vs ${summary.union.correctness.toFixed(2)} (? ${summary.delta.correctness.toFixed(2)})`,
    );
    console.log(
      `Completeness: ${summary.vector.completeness.toFixed(2)} vs ${summary.union.completeness.toFixed(2)} (? ${summary.delta.completeness.toFixed(2)})`,
    );
    console.log(
      `Improves/degrades/equiv: ${summary.comparisonCounts.unionImproves}/${summary.comparisonCounts.unionDegrades}/${summary.comparisonCounts.equivalent}`,
    );
    console.log(`Decision: ${decision.category}`);
    console.log(`Jina (run): ${apiCalls.jina}, OpenAI (run): ${apiCalls.openai}`);
    console.log(`Output: ${OUTPUT_DIR}`);
  } finally {
    await app.close();
    await generationApp.close();
    await judgeApp.close();
    await sourceJudgeApp.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
