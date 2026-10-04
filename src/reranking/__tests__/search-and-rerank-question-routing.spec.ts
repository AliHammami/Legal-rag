import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { OpenAIService } from '../../openai/openai.service.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import { RoutingError } from '../../routing/routing.error.js';
import type { SimilarChunk } from '../../retrieval/types.js';
import { DEFAULT_RETRIEVAL_TOP_K } from '../constants.js';
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

function makeChunk(chunkId: string, corpusId = 'code-penal'): SimilarChunk {
  return {
    corpusId,
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

describe('searchAndRerankQuestion routing integration', () => {
  const prisma = {} as PrismaService;
  const openAIService = {} as OpenAIService;
  const rerankerService = {} as RerankerService;
  const candidates = [makeChunk('122-5#0')];
  const reranked = [{ ...makeChunk('122-5#0'), rerankScore: 0.9 }];

  beforeEach(() => {
    routeQuestionMock.mockReset();
    searchQuestionMock.mockReset();
    rerankChunksMock.mockReset();
    searchQuestionMock.mockResolvedValue(candidates);
    rerankChunksMock.mockResolvedValue(reranked);
  });

  it('routes to a single corpus and passes corpusIds to retrieval', async () => {
    routeQuestionMock.mockResolvedValue({ corpusIds: ['code-penal'] });

    const result = await searchAndRerankQuestion(
      prisma,
      openAIService,
      rerankerService,
      QUESTION,
    );

    expect(routeQuestionMock).toHaveBeenCalledWith(openAIService, QUESTION, {});
    expect(searchQuestionMock).toHaveBeenCalledWith(
      prisma,
      openAIService,
      QUESTION,
      DEFAULT_RETRIEVAL_TOP_K,
      expect.objectContaining({ corpusIds: ['code-penal'] }),
    );
    expect(result.routing).toEqual({
      corpusIds: ['code-penal'],
      decision: 'routed',
      fallbackToGlobal: false,
    });
    expect(result.reranked).toEqual(reranked);
  });

  it('routes to multiple corpora and passes them to retrieval', async () => {
    routeQuestionMock.mockResolvedValue({
      corpusIds: ['code-penal', 'code-civil'],
    });

    await searchAndRerankQuestion(
      prisma,
      openAIService,
      rerankerService,
      QUESTION,
    );

    expect(searchQuestionMock).toHaveBeenCalledWith(
      prisma,
      openAIService,
      QUESTION,
      DEFAULT_RETRIEVAL_TOP_K,
      expect.objectContaining({
        corpusIds: ['code-penal', 'code-civil'],
      }),
    );
  });

  it('abstains when the router returns an empty corpus selection', async () => {
    routeQuestionMock.mockResolvedValue({ corpusIds: [] });

    const result = await searchAndRerankQuestion(
      prisma,
      openAIService,
      rerankerService,
      'Quelle est la loi en France ?',
    );

    expect(searchQuestionMock).not.toHaveBeenCalled();
    expect(rerankChunksMock).not.toHaveBeenCalled();
    expect(result.routing).toEqual({
      corpusIds: [],
      decision: 'abstain',
      fallbackToGlobal: false,
    });
    expect(result.candidates).toEqual([]);
    expect(result.reranked).toEqual([]);
  });

  it('falls back to global retrieval when explicit corpusIds are empty', async () => {
    const result = await searchAndRerankQuestion(
      prisma,
      openAIService,
      rerankerService,
      'Quelle est la loi en France ?',
      { corpusIds: [] },
    );

    expect(routeQuestionMock).not.toHaveBeenCalled();
    expect(searchQuestionMock).toHaveBeenCalledWith(
      prisma,
      openAIService,
      'Quelle est la loi en France ?',
      DEFAULT_RETRIEVAL_TOP_K,
      expect.not.objectContaining({ corpusIds: [] }),
    );
    expect(searchQuestionMock.mock.calls[0]?.[4]?.corpusIds).toBeUndefined();
    expect(result.routing).toEqual({
      corpusIds: [],
      decision: 'global_fallback',
      fallbackToGlobal: true,
    });
  });

  it('propagates router errors without triggering global fallback', async () => {
    routeQuestionMock.mockRejectedValue(
      new RoutingError('OpenAI unavailable', 'OPENAI_UNKNOWN_ERROR'),
    );

    await expect(
      searchAndRerankQuestion(
        prisma,
        openAIService,
        rerankerService,
        QUESTION,
      ),
    ).rejects.toMatchObject({ code: 'OPENAI_UNKNOWN_ERROR' });

    expect(searchQuestionMock).not.toHaveBeenCalled();
    expect(rerankChunksMock).not.toHaveBeenCalled();
  });

  it('skips routing when explicit corpusIds are provided', async () => {
    await searchAndRerankQuestion(
      prisma,
      openAIService,
      rerankerService,
      QUESTION,
      { corpusIds: ['code-civil'], enableRouting: true },
    );

    expect(routeQuestionMock).not.toHaveBeenCalled();
    expect(searchQuestionMock).toHaveBeenCalledWith(
      prisma,
      openAIService,
      QUESTION,
      DEFAULT_RETRIEVAL_TOP_K,
      expect.objectContaining({ corpusIds: ['code-civil'] }),
    );
  });

  it('skips routing when enableRouting is false', async () => {
    await searchAndRerankQuestion(
      prisma,
      openAIService,
      rerankerService,
      QUESTION,
      { enableRouting: false },
    );

    expect(routeQuestionMock).not.toHaveBeenCalled();
    expect(searchQuestionMock).toHaveBeenCalledWith(
      prisma,
      openAIService,
      QUESTION,
      DEFAULT_RETRIEVAL_TOP_K,
      expect.objectContaining({ corpusIds: undefined }),
    );
  });
});
