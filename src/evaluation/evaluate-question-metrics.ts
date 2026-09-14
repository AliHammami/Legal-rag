import { mrr, recallAtK } from './metrics.js';
import type { QuestionEvaluationMetrics } from './types.js';

export function evaluateQuestionMetrics(input: {
  goldArticles: string[];
  vectorTop20Articles: string[];
  vectorTop5Articles: string[];
  jinaTop5Articles: string[];
}): QuestionEvaluationMetrics {
  return {
    recallAt20Vector: recallAtK(
      input.goldArticles,
      input.vectorTop20Articles,
      20,
    ),
    recallAt5Vector: recallAtK(
      input.goldArticles,
      input.vectorTop5Articles,
      5,
    ),
    recallAt5Jina: recallAtK(input.goldArticles, input.jinaTop5Articles, 5),
    mrrVector: mrr(input.goldArticles, input.vectorTop5Articles),
    mrrJina: mrr(input.goldArticles, input.jinaTop5Articles),
  };
}
