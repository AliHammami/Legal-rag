import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPipelineProfiling } from '../../profiling/pipeline-timings.js';
import type { OpenAIService } from '../../openai/openai.service.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { SimilarChunk } from '../../retrieval/types.js';
import { searchAndRerankQuestion } from '../search-and-rerank-question.js';
import type { RerankerService } from '../reranker.service.js';

const { routeQuestionMock, searchQuestionMock, rerankChunksMock } = vi.hoisted(
  () => ({
    routeQuestionMock: vi.fn(),
    searchQuestionMock: vi.fn(),
    rerankChunksMock: vi.fn(),
  }),
);

vi.mock('../../routing/route-question.js', () => ({
  routeQuestion: routeQuestionMock,
}));

vi.mock('../../retrieval/search-question.js', () => ({
  searchQuestion: searchQuestionMock,
}));

vi.mock('../rerank-chunks.js', () => ({
  rerankChunks: rerankChunksMock,
}));

const QUESTION = 'Quelles sont les conditions de la légitime défense ?';

function makeChunk(chunkId: string): SimilarChunk {
  return {
    corpusId: 'code-penal',
    chunkId,
    articleNumber: chunkId.split('#')[0] ?? chunkId,
    content: `Content for ${chunkId}`,
    metadata: {
      articleNumber: chunkId.split('#')[0] ?? chunkId,
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

describe('searchAndRerankQuestion', () => {
  const prisma = {} as PrismaService;
  const openAIService = {} as OpenAIService;
  const rerankerService = {} as RerankerService;
  const candidates = Array.from({ length: 20 }, (_, index) =>
    makeChunk(`${100 + index}-1#0`),
  );
  const reranked = [{ ...makeChunk('122-6#0'), rerankScore: 0.98 }];

  beforeEach(() => {
    routeQuestionMock.mockReset();
    searchQuestionMock.mockReset();
    rerankChunksMock.mockReset();
    routeQuestionMock.mockResolvedValue({ corpusIds: [] });
    searchQuestionMock.mockResolvedValue(candidates);
    rerankChunksMock.mockResolvedValue(reranked);
  });

  it('retrieves 20 candidates and reranks all of them', async () => {
    const profiling = createPipelineProfiling();

    const result = await searchAndRerankQuestion(
      prisma,
      openAIService,
      rerankerService,
      QUESTION,
      { profiling },
    );

    expect(result.candidates).toHaveLength(20);
    expect(result.reranked).toEqual(reranked);
    expect(result.rerankStatus).toBe('success');
    expect(rerankChunksMock).toHaveBeenCalledWith(
      rerankerService,
      QUESTION,
      candidates,
      5,
      { profiling },
    );
    expect(profiling.retrievedCandidates).toBe(20);
    expect(profiling.rerankStatus).toBe('success');
    expect(profiling.totalMs).toBeGreaterThanOrEqual(0);
  });
});
