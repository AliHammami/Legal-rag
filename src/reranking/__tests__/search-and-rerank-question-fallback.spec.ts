import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OpenAIService } from '../../openai/openai.service.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { SimilarChunk } from '../../retrieval/types.js';
import { RerankingError } from '../reranking.error.js';
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

function makeChunk(chunkId: string, distance: number): SimilarChunk {
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
    distance,
  };
}

describe('searchAndRerankQuestion fallback', () => {
  const prisma = {} as PrismaService;
  const openAIService = {} as OpenAIService;
  const rerankerService = {} as RerankerService;
  const candidates = Array.from({ length: 20 }, (_, index) =>
    makeChunk(`${100 + index}-1#0`, index * 0.01),
  );

  beforeEach(() => {
    routeQuestionMock.mockReset();
    searchQuestionMock.mockReset();
    rerankChunksMock.mockReset();
    routeQuestionMock.mockResolvedValue({ corpusIds: [] });
    searchQuestionMock.mockResolvedValue(candidates);
  });

  it('falls back to vector Top 5 when Jina reranking fails', async () => {
    rerankChunksMock.mockRejectedValue(
      new RerankingError('Jina reranker API returned HTTP 503', 'API_ERROR'),
    );

    const result = await searchAndRerankQuestion(
      prisma,
      openAIService,
      rerankerService,
      'Question ?',
    );

    expect(result.rerankStatus).toBe('fallback');
    expect(result.reranked).toHaveLength(5);
    expect(result.reranked.map((chunk) => chunk.chunkId)).toEqual(
      candidates.slice(0, 5).map((chunk) => chunk.chunkId),
    );
    expect(result.reranked.every((chunk) => chunk.rerankScore === undefined)).toBe(
      true,
    );
  });

  it('propagates missing API key configuration errors', async () => {
    rerankChunksMock.mockRejectedValue(
      new RerankingError('JINA_API_KEY is not configured', 'CONFIG_MISSING'),
    );

    await expect(
      searchAndRerankQuestion(prisma, openAIService, rerankerService, 'Question ?'),
    ).rejects.toMatchObject({ code: 'CONFIG_MISSING' });
  });
});
