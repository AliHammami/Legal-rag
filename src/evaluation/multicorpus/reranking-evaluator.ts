import { performance } from 'node:perf_hooks';

import type { OpenAIService } from '../../openai/openai.service.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import { rerankChunks } from '../../reranking/rerank-chunks.js';
import type { RerankerService } from '../../reranking/reranker.service.js';
import { searchQuestion } from '../../retrieval/search-question.js';
import type { LegalMulticorpusEvaluationQuestion } from '../multicorpus-dataset.types.js';
import {
  buildMulticorpusCacheKey,
  readCachedResult,
  writeCachedResult,
} from './cache.js';
import { goldArticlesFromChunks } from './breakdown.js';
import { buildRetrievalMetricsSnapshot } from './metrics.js';
import type { MulticorpusModelConfiguration, RerankingQuestionResult } from './types.js';
import { logEvaluationProgress } from './progress.js';

export async function evaluateRerankingQuestion(
  prisma: PrismaService,
  openAIService: OpenAIService,
  rerankerService: RerankerService,
  question: LegalMulticorpusEvaluationQuestion,
  modelConfiguration: MulticorpusModelConfiguration,
): Promise<RerankingQuestionResult> {
  const startedAt = performance.now();
  const candidates = await searchQuestion(
    prisma,
    openAIService,
    question.question,
    modelConfiguration.retrievalTopK,
  );

  const vectorTop5Articles = goldArticlesFromChunks(candidates.slice(0, 5));
  const reranked = await rerankChunks(
    rerankerService,
    question.question,
    candidates,
    modelConfiguration.rerankTopK,
  );
  const jinaTop5Articles = goldArticlesFromChunks(reranked);

  const goldArticles = question.goldArticles;
  const vectorTop5 = buildRetrievalMetricsSnapshot(goldArticles, vectorTop5Articles);
  const jinaTop5 = buildRetrievalMetricsSnapshot(goldArticles, jinaTop5Articles);

  let rerankEffect: RerankingQuestionResult['rerankEffect'] = 'unchanged';
  if (jinaTop5.recallAt5 > vectorTop5.recallAt5 || jinaTop5.mrr > vectorTop5.mrr) {
    rerankEffect = 'improved';
  } else if (jinaTop5.recallAt5 < vectorTop5.recallAt5 || jinaTop5.mrr < vectorTop5.mrr) {
    rerankEffect = 'degraded';
  }

  return {
    questionId: question.id,
    questionType: question.questionType,
    difficulty: question.difficulty,
    goldArticles,
    vectorTop5,
    jinaTop5,
    rerankEffect,
    latencyMs: performance.now() - startedAt,
  };
}

export async function evaluateRerankingQuestions(
  prisma: PrismaService,
  openAIService: OpenAIService,
  rerankerService: RerankerService,
  questions: LegalMulticorpusEvaluationQuestion[],
  modelConfiguration: MulticorpusModelConfiguration,
  options: {
    runDir: string;
    force: boolean;
    concurrency: number;
  },
): Promise<RerankingQuestionResult[]> {
  const evaluable = questions.filter(
    (question) =>
      question.questionType === 'single-corpus' ||
      question.questionType === 'multi-corpus',
  );

  const results: RerankingQuestionResult[] = new Array(evaluable.length);
  let index = 0;
  let completed = 0;

  async function worker(): Promise<void> {
    while (index < evaluable.length) {
      const current = index++;
      const question = evaluable[current]!;
      const cacheKey = buildMulticorpusCacheKey({
        questionId: question.id,
        mode: 'reranking',
        modelConfiguration,
      });

      if (!options.force) {
        const cached = await readCachedResult<RerankingQuestionResult>(
          options.runDir,
          'reranking',
          cacheKey,
        );
        if (cached) {
          results[current] = cached;
          completed += 1;
          logEvaluationProgress('reranking', completed, evaluable.length, question.id, 'cache');
          continue;
        }
      }

      const result = await evaluateRerankingQuestion(
        prisma,
        openAIService,
        rerankerService,
        question,
        modelConfiguration,
      );
      results[current] = result;
      await writeCachedResult(options.runDir, 'reranking', cacheKey, result);
      completed += 1;
      logEvaluationProgress('reranking', completed, evaluable.length, question.id, 'eval');
    }
  }

  await Promise.all(
    Array.from({ length: options.concurrency }, () => worker()),
  );

  return results;
}
