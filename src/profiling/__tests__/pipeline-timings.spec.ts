import { describe, expect, it } from 'vitest';
import {
  createPipelineProfiling,
  formatAnswerPerformanceReport,
  formatPerformanceReport,
} from '../pipeline-timings.js';

describe('pipeline timings', () => {
  it('creates zeroed profiling metrics', () => {
    const profiling = createPipelineProfiling();

    expect(profiling).toEqual({
      embeddingMs: 0,
      vectorSearchMs: 0,
      jinaRerankingMs: 0,
      mappingMs: 0,
      totalMs: 0,
      embeddingCalls: 0,
      rerankingCalls: 0,
      retrievedCandidates: 0,
      rerankStatus: 'pending',
      contextBuilderMs: 0,
      generationMs: 0,
      generationCalls: 0,
      answerPipelineTotalMs: 0,
    });
  });

  it('formats a Jina performance report', () => {
    const report = formatPerformanceReport({
      embeddingMs: 1050,
      vectorSearchMs: 210,
      jinaRerankingMs: 450,
      mappingMs: 1,
      totalMs: 1711,
      embeddingCalls: 1,
      rerankingCalls: 1,
      retrievedCandidates: 20,
      rerankStatus: 'success',
    });

    expect(report).toContain('Retrieved candidates :  20');
    expect(report).toContain('Jina reranking       :  450 ms');
    expect(report).toContain('Mapping              :  1 ms');
    expect(report).toContain('Fallback             :  no');
    expect(report).toContain('Reranking calls      :  1');
  });

  it('labels fallback status in the report', () => {
    const report = formatPerformanceReport({
      embeddingMs: 0,
      vectorSearchMs: 0,
      jinaRerankingMs: 0,
      mappingMs: 0,
      totalMs: 0,
      embeddingCalls: 1,
      rerankingCalls: 1,
      retrievedCandidates: 20,
      rerankStatus: 'fallback',
    });

    expect(report).toContain('Fallback             :  vector retrieval');
  });

  it('formats answer pipeline metrics', () => {
    const report = formatAnswerPerformanceReport({
      embeddingMs: 1000,
      vectorSearchMs: 200,
      jinaRerankingMs: 300,
      mappingMs: 1,
      totalMs: 1500,
      embeddingCalls: 1,
      rerankingCalls: 1,
      retrievedCandidates: 20,
      rerankStatus: 'success',
      contextBuilderMs: 2,
      generationMs: 4000,
      generationCalls: 1,
      answerPipelineTotalMs: 5500,
    });

    expect(report).toContain('Context builder      :  2 ms');
    expect(report).toContain('Generation LLM       :  4000 ms');
    expect(report).toContain('Answer pipeline total:  5500 ms');
  });
});
