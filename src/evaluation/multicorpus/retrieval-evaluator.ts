import { performance } from 'node:perf_hooks';

import type { OpenAIService } from '../../openai/openai.service.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import { resolveRoutingForRetrieval } from '../../routing/resolve-routing-for-retrieval.js';
import { searchQuestion } from '../../retrieval/search-question.js';
import type { LegalMulticorpusEvaluationQuestion } from '../multicorpus-dataset.types.js';
import {
  buildMulticorpusCacheKey,
  readCachedResult,
  writeCachedResult,
} from './cache.js';
import { goldArticlesFromChunks } from './breakdown.js';
import { buildRetrievalMetricsSnapshot } from './metrics.js';
import type { MulticorpusModelConfiguration, RetrievalQuestionResult } from './types.js';
import { logEvaluationProgress } from './progress.js';

export async function evaluateRetrievalQuestion(
  prisma: PrismaService,
  openAIService: OpenAIService,
  question: LegalMulticorpusEvaluationQuestion,
  modelConfiguration: MulticorpusModelConfiguration,
): Promise<RetrievalQuestionResult> {
  const globalStart = performance.now();
  const globalCandidates = await searchQuestion(
    prisma,
    openAIService,
    question.question,
    modelConfiguration.retrievalTopK,
  );
  const globalLatencyMs = performance.now() - globalStart;

  const routedStart = performance.now();
  const resolved = await resolveRoutingForRetrieval(
    openAIService,
    question.question,
    { model: modelConfiguration.routingModel },
  );
  const routedCandidates = await searchQuestion(
    prisma,
    openAIService,
    question.question,
    modelConfiguration.retrievalTopK,
    {
      corpusIds: resolved.retrievalCorpusIds,
    },
  );
  const routedLatencyMs = performance.now() - routedStart;

  const goldArticles = question.goldArticles;
  const globalRetrieved = goldArticlesFromChunks(globalCandidates);
  const routedRetrieved = goldArticlesFromChunks(routedCandidates);

  return {
    questionId: question.id,
    questionType: question.questionType,
    difficulty: question.difficulty,
    goldArticles,
    global: buildRetrievalMetricsSnapshot(goldArticles, globalRetrieved),
    routed: buildRetrievalMetricsSnapshot(goldArticles, routedRetrieved),
    latencyMs: {
      global: globalLatencyMs,
      routed: routedLatencyMs,
    },
  };
}

export async function evaluateRetrievalQuestions(
  prisma: PrismaService,
  openAIService: OpenAIService,
  questions: LegalMulticorpusEvaluationQuestion[],
  modelConfiguration: MulticorpusModelConfiguration,
  options: {
    runDir: string;
    force: boolean;
    concurrency: number;
  },
): Promise<RetrievalQuestionResult[]> {
  const evaluable = questions.filter(
    (question) =>
      question.questionType === 'single-corpus' ||
      question.questionType === 'multi-corpus',
  );

  const results: RetrievalQuestionResult[] = new Array(evaluable.length);
  let index = 0;
  let completed = 0;

  async function worker(): Promise<void> {
    while (index < evaluable.length) {
      const current = index++;
      const question = evaluable[current]!;
      const cacheKey = buildMulticorpusCacheKey({
        questionId: question.id,
        mode: 'retrieval',
        modelConfiguration,
      });

      if (!options.force) {
        const cached = await readCachedResult<RetrievalQuestionResult>(
          options.runDir,
          'retrieval',
          cacheKey,
        );
        if (cached) {
          results[current] = cached;
          completed += 1;
          logEvaluationProgress('retrieval', completed, evaluable.length, question.id, 'cache');
          continue;
        }
      }

      const result = await evaluateRetrievalQuestion(
        prisma,
        openAIService,
        question,
        modelConfiguration,
      );
      results[current] = result;
      await writeCachedResult(options.runDir, 'retrieval', cacheKey, result);
      completed += 1;
      logEvaluationProgress('retrieval', completed, evaluable.length, question.id, 'eval');
    }
  }

  await Promise.all(
    Array.from({ length: options.concurrency }, () => worker()),
  );

  return results;
}
