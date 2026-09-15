import { describe, expect, it } from 'vitest';

import {
  buildE2EQuestionResultError,
  buildE2EQuestionResultSuccess,
} from '../build-e2e-question-result.js';
import type { E2EEvaluationQuestion } from '../types.js';

const question: E2EEvaluationQuestion = {
  id: 'q001',
  question: 'Quelles sont les conditions de la légitime défense ?',
  goldArticles: ['122-5', '122-6'],
  referenceAnswer: 'Réponse de référence.',
  expectedAbstention: false,
};

describe('buildE2EQuestionResultSuccess', () => {
  it('captures retrieval, reranking, filtered context, sources and timings', () => {
    const result = buildE2EQuestionResultSuccess({
      question,
      pipelineResult: {
        answer: 'Réponse générée.',
        context: 'CONTEXTE LLM',
        candidates: [
          {
            chunkId: '122-6#0',
            articleNumber: '122-6',
            distance: 0.35,
          },
          {
            chunkId: '122-5#0',
            articleNumber: '122-5',
            distance: 0.39,
          },
        ],
        reranked: [
          {
            chunkId: '122-6#0',
            articleNumber: '122-6',
            distance: 0.35,
            rerankScore: 0.2965,
          },
          {
            chunkId: '122-5#0',
            articleNumber: '122-5',
            distance: 0.39,
            rerankScore: 0.1197,
          },
        ],
        rerankStatus: 'success',
        contextFiltering: {
          jinaResults: 2,
          contextResults: 2,
          relativeScoreThreshold: 0.4,
        },
        sources: [
          {
            sourceId: 1,
            chunkId: '122-6#0',
            articleNumber: '122-6',
            chunkIndex: 0,
            chunk: {
              chunkId: '122-6#0',
              articleNumber: '122-6',
              distance: 0.35,
              rerankScore: 0.2965,
            },
          },
          {
            sourceId: 2,
            chunkId: '122-5#0',
            articleNumber: '122-5',
            chunkIndex: 0,
            chunk: {
              chunkId: '122-5#0',
              articleNumber: '122-5',
              distance: 0.39,
              rerankScore: 0.1197,
            },
          },
        ],
        profiling: {
          embeddingMs: 100,
          vectorSearchMs: 50,
          jinaRerankingMs: 200,
          mappingMs: 1,
          totalMs: 351,
          embeddingCalls: 1,
          rerankingCalls: 1,
          retrievedCandidates: 2,
          rerankStatus: 'success',
          contextFilteringMs: 1,
          contextBuilderMs: 2,
          generationMs: 3000,
          generationCalls: 1,
          answerPipelineTotalMs: 3354,
        },
      },
    });

    expect(result.status).toBe('success');
    expect(result.generatedAnswer).toBe('Réponse générée.');
    expect(result.context).toBe('CONTEXTE LLM');
    expect(result.retrievedChunks).toHaveLength(2);
    expect(result.rerankedChunks[1]?.score).toBe(0.1197);
    expect(result.filteredContextChunks).toHaveLength(2);
    expect(result.filteredContextChunks[1]?.relativeScore).toBeCloseTo(
      0.1197 / 0.2965,
      5,
    );
    expect(result.sources).toEqual([
      {
        sourceId: 1,
        chunkId: '122-6#0',
        articleNumber: '122-6',
        chunkIndex: 0,
      },
      {
        sourceId: 2,
        chunkId: '122-5#0',
        articleNumber: '122-5',
        chunkIndex: 0,
      },
    ]);
    expect(result.timings.answerPipelineTotalMs).toBe(3354);
  });
});

describe('buildE2EQuestionResultError', () => {
  it('stores a compact error snapshot without stack trace', () => {
    const result = buildE2EQuestionResultError(
      question,
      new Error('Generation failed'),
    );

    expect(result.status).toBe('error');
    expect(result.error).toEqual({
      message: 'Generation failed',
      code: 'Error',
    });
    expect(result).not.toHaveProperty('stack');
  });
});
