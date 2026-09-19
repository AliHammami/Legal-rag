import { performance } from 'node:perf_hooks';

import type { OpenAIService } from '../../openai/openai.service.js';
import { routeQuestion } from '../../routing/route-question.js';
import type { LegalMulticorpusEvaluationQuestion } from '../multicorpus-dataset.types.js';
import {
  buildMulticorpusCacheKey,
  readCachedResult,
  writeCachedResult,
} from './cache.js';
import type { MulticorpusModelConfiguration, RoutingQuestionResult } from './types.js';
import { corpusPrecisionRecallF1 } from './metrics.js';
import { logEvaluationProgress } from './progress.js';

export async function evaluateRoutingQuestion(
  openAIService: OpenAIService,
  question: LegalMulticorpusEvaluationQuestion,
  modelConfiguration: MulticorpusModelConfiguration,
): Promise<RoutingQuestionResult> {
  const startedAt = performance.now();
  const routing = await routeQuestion(openAIService, question.question, {
    model: modelConfiguration.routingModel,
  });
  const latencyMs = performance.now() - startedAt;
  const predictedCorpusIds = [...routing.corpusIds].sort();
  const goldCorpusIds = [...question.goldCorpusIds].sort();
  const scores = corpusPrecisionRecallF1(goldCorpusIds, predictedCorpusIds);

  return {
    questionId: question.id,
    questionType: question.questionType,
    difficulty: question.difficulty,
    goldCorpusIds,
    predictedCorpusIds,
    exactMatch: scores.exactMatch,
    precision: scores.precision,
    recall: scores.recall,
    f1: scores.f1,
    latencyMs,
    fallbackToGlobal: predictedCorpusIds.length === 0,
  };
}

export async function evaluateRoutingQuestions(
  openAIService: OpenAIService,
  questions: LegalMulticorpusEvaluationQuestion[],
  modelConfiguration: MulticorpusModelConfiguration,
  options: {
    runDir: string;
    force: boolean;
    concurrency: number;
  },
): Promise<RoutingQuestionResult[]> {
  const results: RoutingQuestionResult[] = new Array(questions.length);

  let index = 0;
  let completed = 0;
  async function worker(): Promise<void> {
    while (index < questions.length) {
      const current = index++;
      const question = questions[current]!;
      const cacheKey = buildMulticorpusCacheKey({
        questionId: question.id,
        mode: 'routing',
        modelConfiguration,
      });

      if (!options.force) {
        const cached = await readCachedResult<RoutingQuestionResult>(
          options.runDir,
          'routing',
          cacheKey,
        );
        if (cached) {
          results[current] = cached;
          completed += 1;
          logEvaluationProgress('routing', completed, questions.length, question.id, 'cache');
          continue;
        }
      }

      const result = await evaluateRoutingQuestion(
        openAIService,
        question,
        modelConfiguration,
      );
      results[current] = result;
      await writeCachedResult(options.runDir, 'routing', cacheKey, result);
      completed += 1;
      logEvaluationProgress('routing', completed, questions.length, question.id, 'eval');
    }
  }

  await Promise.all(
    Array.from({ length: options.concurrency }, () => worker()),
  );

  return results;
}
