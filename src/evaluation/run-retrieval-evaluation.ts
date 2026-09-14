import type { PipelineProfilingTimings } from '../profiling/pipeline-timings.js';
import { createPipelineProfiling } from '../profiling/pipeline-timings.js';
import type { SimilarChunk } from '../retrieval/types.js';
import type { SearchAndRerankQuestionResult } from '../reranking/search-and-rerank-question.js';
import {
  EVALUATION_RERANK_TOP_K,
  EVALUATION_RETRIEVAL_TOP_K,
} from './constants.js';
import { evaluateQuestionMetrics } from './evaluate-question-metrics.js';
import { buildEvaluationSummary } from './format-evaluation-report.js';
import type {
  EvaluationQuestion,
  QuestionEvaluationResult,
  RetrievalEvaluationReport,
} from './types.js';

export interface RunRetrievalEvaluationDeps {
  evaluateQuestion: (
    question: EvaluationQuestion,
  ) => Promise<SearchAndRerankQuestionResult & { profiling: PipelineProfilingTimings }>;
}

function toArticleNumbers(chunks: SimilarChunk[]): string[] {
  return chunks.map((chunk) => chunk.articleNumber);
}

export async function runRetrievalEvaluation(
  questions: EvaluationQuestion[],
  deps: RunRetrievalEvaluationDeps,
): Promise<RetrievalEvaluationReport> {
  const results: QuestionEvaluationResult[] = [];

  for (const question of questions) {
    const profiling = createPipelineProfiling();
    const pipelineResult = await deps.evaluateQuestion(question);
    const vectorTop20 = pipelineResult.candidates;
    const vectorTop5 = vectorTop20.slice(0, EVALUATION_RERANK_TOP_K);
    const jinaTop5 = pipelineResult.reranked;

    const metrics = evaluateQuestionMetrics({
      goldArticles: question.goldArticles,
      vectorTop20Articles: toArticleNumbers(vectorTop20),
      vectorTop5Articles: toArticleNumbers(vectorTop5),
      jinaTop5Articles: toArticleNumbers(jinaTop5),
    });

    results.push({
      question,
      vectorTop20,
      vectorTop5,
      jinaTop5,
      rerankStatus: pipelineResult.rerankStatus,
      metrics,
      profiling: pipelineResult.profiling ?? profiling,
    });
  }

  return {
    results,
    summary: buildEvaluationSummary(results),
  };
}

export { EVALUATION_RETRIEVAL_TOP_K, EVALUATION_RERANK_TOP_K };
