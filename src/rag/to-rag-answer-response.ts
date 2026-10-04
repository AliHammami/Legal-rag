import type { AnswerQuestionResult } from '../generation/types.js';
import type { RagAnswerResponse } from './rag-answer-response.types.js';

export function toRagAnswerResponse(
  result: AnswerQuestionResult,
): RagAnswerResponse {
  return {
    question: result.question,
    answer: result.answer,
    routing: result.routing
      ? {
          decision: result.routing.decision,
          corpusIds: result.routing.corpusIds,
          fallbackToGlobal: result.routing.fallbackToGlobal,
        }
      : null,
    rerankStatus: result.rerankStatus,
    sources: result.sources.map((source) => ({
      sourceId: source.sourceId,
      codeName: source.codeName,
      articleNumber: source.articleNumber,
      chunkIndex: source.chunkIndex,
    })),
  };
}
