export interface PipelineProfilingTimings {
  embeddingMs: number;
  vectorSearchMs: number;
  rerankingOpenAiMs: number;
  parsingValidationMs: number;
  totalMs: number;
  embeddingCalls: number;
  rerankingCalls: number;
  rerankAttempts: number;
}

export function createPipelineProfiling(): PipelineProfilingTimings {
  return {
    embeddingMs: 0,
    vectorSearchMs: 0,
    rerankingOpenAiMs: 0,
    parsingValidationMs: 0,
    totalMs: 0,
    embeddingCalls: 0,
    rerankingCalls: 0,
    rerankAttempts: 0,
  };
}

export function formatPerformanceReport(
  timings: PipelineProfilingTimings,
): string {
  return [
    '--- Performance ---',
    `Embedding           :  ${Math.round(timings.embeddingMs)} ms`,
    `Vector search       :  ${Math.round(timings.vectorSearchMs)} ms`,
    `Reranking OpenAI    :  ${Math.round(timings.rerankingOpenAiMs)} ms`,
    `Parsing/validation  :  ${Math.round(timings.parsingValidationMs)} ms`,
    `Total               :  ${Math.round(timings.totalMs)} ms`,
    `Embedding calls     :  ${timings.embeddingCalls}`,
    `Reranking calls     :  ${timings.rerankingCalls}`,
    `Rerank attempts     :  ${timings.rerankAttempts}`,
  ].join('\n');
}
