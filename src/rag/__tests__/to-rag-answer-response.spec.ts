import { describe, expect, it } from 'vitest';

import type { AnswerQuestionResult } from '../../generation/types.js';
import { createPipelineProfiling } from '../../profiling/pipeline-timings.js';
import { toRagAnswerResponse } from '../to-rag-answer-response.js';

describe('toRagAnswerResponse', () => {
  it('maps pipeline result to public HTTP shape without chunk payloads', () => {
    const result: AnswerQuestionResult = {
      question: 'Question test',
      routing: {
        decision: 'routed',
        corpusIds: ['code-civil'],
        fallbackToGlobal: false,
      },
      candidates: [],
      reranked: [],
      rerankStatus: 'success',
      contextFiltering: {
        jinaResults: 2,
        contextResults: 1,
        relativeScoreThreshold: 0.4,
      },
      context: 'ctx',
      sources: [
        {
          sourceId: 1,
          chunkId: 'chunk-1',
          codeName: 'Code civil',
          articleNumber: '1240',
          chunkIndex: 0,
          content: 'secret chunk body',
          chunk: {} as AnswerQuestionResult['sources'][0]['chunk'],
        },
      ],
      answer: 'R?ponse RAG.',
      profiling: createPipelineProfiling(),
    };

    expect(toRagAnswerResponse(result)).toEqual({
      question: 'Question test',
      answer: 'R?ponse RAG.',
      routing: {
        decision: 'routed',
        corpusIds: ['code-civil'],
        fallbackToGlobal: false,
      },
      rerankStatus: 'success',
      sources: [
        {
          sourceId: 1,
          codeName: 'Code civil',
          articleNumber: '1240',
          chunkIndex: 0,
        },
      ],
    });
  });
});
