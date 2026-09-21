import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { OpenAIService } from '../../openai/openai.service.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { RerankerService } from '../../reranking/reranker.service.js';
import type { RerankedChunk } from '../../reranking/types.js';
import { answerQuestion } from '../answer-question.js';
import type { RagGenerationService } from '../rag-generation.service.js';

const { searchAndRerankQuestionMock } = vi.hoisted(() => ({
  searchAndRerankQuestionMock: vi.fn(),
}));

vi.mock('../../reranking/search-and-rerank-question.js', () => ({
  searchAndRerankQuestion: searchAndRerankQuestionMock,
}));

function makeRerankedChunk(
  chunkId: string,
  corpusId: string,
  rerankScore: number,
): RerankedChunk {
  const articleNumber = chunkId.split('#')[0] ?? chunkId;

  return {
    corpusId,
    chunkId,
    articleNumber,
    content: `Content for ${chunkId}`,
    distance: 0.2,
    rerankScore,
    metadata: {
      articleNumber,
      pageStart: 1,
      pageEnd: 1,
      source: `data/${corpusId}.pdf`,
      sourceType: 'pdf',
      chunkIndex: 0,
      chunkCount: 1,
      unitStart: 0,
      unitEnd: 0,
      unitCount: 1,
    },
  };
}

describe('answerQuestion global fallback filter behavior', () => {
  const prisma = {} as PrismaService;
  const openAIService = {} as OpenAIService;
  const rerankerService = {} as RerankerService;
  const generateAnswer = vi.fn().mockResolvedValue('generated answer');
  const generationService = {
    generateAnswer,
  } as unknown as RagGenerationService;

  beforeEach(() => {
    searchAndRerankQuestionMock.mockReset();
    generateAnswer.mockClear();
  });

  it('does not apply min1/corpus when routing uses global fallback', async () => {
    const reranked = [
      makeRerankedChunk('L1237-3#0', 'code-du-travail', 1.0),
      makeRerankedChunk('L1224-2#0', 'code-du-travail', 0.5),
      makeRerankedChunk('10#0', 'code-civil', 0.15),
    ];

    searchAndRerankQuestionMock.mockResolvedValue({
      candidates: [],
      reranked,
      rerankStatus: 'success',
      routing: {
        corpusIds: [],
        decision: 'global_fallback',
        fallbackToGlobal: true,
      },
    });

    const result = await answerQuestion(
      prisma,
      openAIService,
      rerankerService,
      generationService,
      'Question global fallback',
    );

    expect(result.contextFiltering.contextResults).toBe(2);
    expect(result.sources.map((source) => source.chunkId)).toEqual([
      'L1237-3#0',
      'L1224-2#0',
    ]);
  });
});
