import { describe, expect, it } from 'vitest';
import {
  createPipelineProfiling,
  formatPerformanceReport,
} from '../pipeline-timings.js';

describe('pipeline timings', () => {
  it('creates zeroed profiling metrics', () => {
    const profiling = createPipelineProfiling();

    expect(profiling).toEqual({
      embeddingMs: 0,
      vectorSearchMs: 0,
      rerankingOpenAiMs: 0,
      parsingValidationMs: 0,
      totalMs: 0,
      embeddingCalls: 0,
      rerankingCalls: 0,
      rerankAttempts: 0,
    });
  });

  it('formats a performance report', () => {
    const report = formatPerformanceReport({
      embeddingMs: 1234.6,
      vectorSearchMs: 56.2,
      rerankingOpenAiMs: 42000.4,
      parsingValidationMs: 3.1,
      totalMs: 43294.3,
      embeddingCalls: 1,
      rerankingCalls: 2,
      rerankAttempts: 2,
    });

    expect(report).toContain('Embedding           :  1235 ms');
    expect(report).toContain('Vector search       :  56 ms');
    expect(report).toContain('Reranking OpenAI    :  42000 ms');
    expect(report).toContain('Parsing/validation  :  3 ms');
    expect(report).toContain('Total               :  43294 ms');
    expect(report).toContain('Embedding calls     :  1');
    expect(report).toContain('Reranking calls     :  2');
    expect(report).toContain('Rerank attempts     :  2');
  });
});
