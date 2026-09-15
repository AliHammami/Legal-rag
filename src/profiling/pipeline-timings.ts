import type { RerankStatus } from '../reranking/types.js';

export interface PipelineProfilingTimings {
  embeddingMs: number;
  vectorSearchMs: number;
  jinaRerankingMs: number;
  mappingMs: number;
  totalMs: number;
  embeddingCalls: number;
  rerankingCalls: number;
  retrievedCandidates: number;
  rerankStatus: RerankStatus | 'pending';
  contextFilteringMs: number;
  contextBuilderMs: number;
  generationMs: number;
  generationCalls: number;
  answerPipelineTotalMs: number;
}

export function createPipelineProfiling(): PipelineProfilingTimings {
  return {
    embeddingMs: 0,
    vectorSearchMs: 0,
    jinaRerankingMs: 0,
    mappingMs: 0,
    totalMs: 0,
    embeddingCalls: 0,
    rerankingCalls: 0,
    retrievedCandidates: 0,
    rerankStatus: 'pending',
    contextFilteringMs: 0,
    contextBuilderMs: 0,
    generationMs: 0,
    generationCalls: 0,
    answerPipelineTotalMs: 0,
  };
}

export function formatPerformanceReport(
  timings: PipelineProfilingTimings,
): string {
  const fallbackLabel =
    timings.rerankStatus === 'fallback' ? 'vector retrieval' : 'no';
  const statusLabel =
    timings.rerankStatus === 'success'
      ? 'Jina'
      : timings.rerankStatus === 'fallback'
        ? 'Jina (failed → fallback)'
        : timings.rerankStatus;

  return [
    '--- Performance ---',
    `Retrieved candidates :  ${timings.retrievedCandidates}`,
    `Reranking            :  ${statusLabel}`,
    `Fallback             :  ${fallbackLabel}`,
    `Embedding            :  ${Math.round(timings.embeddingMs)} ms`,
    `Vector search        :  ${Math.round(timings.vectorSearchMs)} ms`,
    `Jina reranking       :  ${Math.round(timings.jinaRerankingMs)} ms`,
    `Mapping              :  ${Math.round(timings.mappingMs)} ms`,
    `Total                :  ${Math.round(timings.totalMs)} ms`,
    `Embedding calls      :  ${timings.embeddingCalls}`,
    `Reranking calls      :  ${timings.rerankingCalls}`,
  ].join('\n');
}

export function formatAnswerPerformanceReport(
  timings: PipelineProfilingTimings,
): string {
  const baseReport = formatPerformanceReport(timings);

  return [
    baseReport,
    `Context filtering    :  ${Math.round(timings.contextFilteringMs)} ms`,
    `Context builder      :  ${Math.round(timings.contextBuilderMs)} ms`,
    `Generation LLM       :  ${Math.round(timings.generationMs)} ms`,
    `Generation calls     :  ${timings.generationCalls}`,
    `Answer pipeline total:  ${Math.round(timings.answerPipelineTotalMs)} ms`,
  ].join('\n');
}
