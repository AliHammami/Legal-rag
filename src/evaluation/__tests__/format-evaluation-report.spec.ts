import { describe, expect, it } from 'vitest';
import { createPipelineProfiling } from '../../profiling/pipeline-timings.js';
import type { SimilarChunk } from '../../retrieval/types.js';
import {
  buildEvaluationSummary,
  formatEvaluationSummary,
  formatQuestionEvaluationResult,
} from '../format-evaluation-report.js';
import type { QuestionEvaluationResult } from '../types.js';

function makeChunk(articleNumber: string): SimilarChunk {
  return {
    chunkId: `${articleNumber}#0`,
    articleNumber,
    content: `Content ${articleNumber}`,
    metadata: {
      articleNumber,
      pageStart: 1,
      pageEnd: 1,
      source: 'data/code-penal.pdf',
      sourceType: 'pdf',
      chunkIndex: 0,
      chunkCount: 1,
      unitStart: 0,
      unitEnd: 0,
      unitCount: 1,
    },
    distance: 0.2,
  };
}

describe('formatQuestionEvaluationResult', () => {
  it('formats per-question metrics with HIT/MISS labels', () => {
    const result: QuestionEvaluationResult = {
      question: {
        id: 'q001',
        question: 'Quelles sont les conditions de la légitime défense ?',
        goldArticles: ['122-5', '122-6'],
      },
      vectorTop20: [],
      vectorTop5: [makeChunk('122-6'), makeChunk('122-5')],
      jinaTop5: [makeChunk('122-6'), makeChunk('122-5')],
      rerankStatus: 'success',
      metrics: {
        recallAt20Vector: 1,
        recallAt5Vector: 1,
        recallAt5Jina: 1,
        mrrVector: 1,
        mrrJina: 1,
      },
      profiling: createPipelineProfiling(),
    };

    const formatted = formatQuestionEvaluationResult(result);
    expect(formatted).toContain('[q001]');
    expect(formatted).toContain('Recall@5 Vector:  HIT');
    expect(formatted).toContain('MRR Jina:   1.000');
  });
});

describe('buildEvaluationSummary', () => {
  it('aggregates global metrics and latency averages', () => {
    const profiling = createPipelineProfiling();
    profiling.embeddingMs = 1000;
    profiling.vectorSearchMs = 200;
    profiling.jinaRerankingMs = 500;
    profiling.totalMs = 1700;

    const summary = buildEvaluationSummary([
      {
        question: { id: 'q001', question: 'Q1', goldArticles: ['122-5'] },
        vectorTop20: [],
        vectorTop5: [makeChunk('122-5')],
        jinaTop5: [makeChunk('122-5')],
        rerankStatus: 'success',
        metrics: {
          recallAt20Vector: 1,
          recallAt5Vector: 1,
          recallAt5Jina: 1,
          mrrVector: 1,
          mrrJina: 1,
        },
        profiling,
      },
      {
        question: { id: 'q002', question: 'Q2', goldArticles: ['122-7'] },
        vectorTop20: [],
        vectorTop5: [makeChunk('462-9')],
        jinaTop5: [makeChunk('122-7')],
        rerankStatus: 'success',
        metrics: {
          recallAt20Vector: 0,
          recallAt5Vector: 0,
          recallAt5Jina: 1,
          mrrVector: 0,
          mrrJina: 1,
        },
        profiling,
      },
    ]);

    expect(summary.questionCount).toBe(2);
    expect(summary.recallAt5Vector).toBe(0.5);
    expect(summary.recallAt5Jina).toBe(1);
    expect(summary.recallAt5ImprovementPoints).toBe(50);
    expect(summary.averageEmbeddingMs).toBe(1000);

    const formatted = formatEvaluationSummary(summary);
    expect(formatted).toContain('# RAG RETRIEVAL EVALUATION');
    expect(formatted).toContain('Recall@5:  50.0%');
    expect(formatted).toContain('Recall@5: +50.0 pts');
  });
});
