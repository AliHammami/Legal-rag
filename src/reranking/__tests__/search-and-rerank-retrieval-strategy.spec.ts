import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { OpenAIService } from '../../openai/openai.service.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import { DEFAULT_RETRIEVAL_TOP_K } from '../constants.js';
import { searchAndRerankQuestion } from '../search-and-rerank-question.js';
import type { RerankerService } from '../reranker.service.js';

const {
  searchQuestionMock,
  retrieveHybridUnionCandidatesMock,
  rerankChunksMock,
} = vi.hoisted(() => ({
  searchQuestionMock: vi.fn(),
  retrieveHybridUnionCandidatesMock: vi.fn(),
  rerankChunksMock: vi.fn(),
}));

vi.mock('../../retrieval/search-question.js', () => ({
  searchQuestion: searchQuestionMock,
}));

vi.mock('../../retrieval/hybrid-union-retrieval.js', () => ({
  retrieveHybridUnionCandidates: retrieveHybridUnionCandidatesMock,
}));

vi.mock('../rerank-chunks.js', () => ({
  rerankChunks: rerankChunksMock,
}));

describe('searchAndRerankQuestion retrievalStrategy', () => {
  const prisma = {} as PrismaService;
  const openAIService = {} as OpenAIService;
  const rerankerService = {} as RerankerService;
  const candidates = [{ chunkId: '1#0' }];
  const reranked = [{ chunkId: '1#0', rerankScore: 1 }];

  beforeEach(() => {
    searchQuestionMock.mockReset();
    retrieveHybridUnionCandidatesMock.mockReset();
    rerankChunksMock.mockReset();
    searchQuestionMock.mockResolvedValue(candidates);
    retrieveHybridUnionCandidatesMock.mockResolvedValue(candidates);
    rerankChunksMock.mockResolvedValue(reranked);
  });

  it('uses vector searchQuestion when strategy is vector', async () => {
    await searchAndRerankQuestion(
      prisma,
      openAIService,
      rerankerService,
      'Question test',
      {
        enableRouting: false,
        corpusIds: ['code-penal'],
        retrievalStrategy: 'vector',
      },
    );

    expect(searchQuestionMock).toHaveBeenCalledWith(
      prisma,
      openAIService,
      'Question test',
      DEFAULT_RETRIEVAL_TOP_K,
      expect.objectContaining({ corpusIds: ['code-penal'] }),
    );
    expect(retrieveHybridUnionCandidatesMock).not.toHaveBeenCalled();
    expect(rerankChunksMock).toHaveBeenCalled();
  });

  it('uses hybrid union retrieval when strategy is hybrid-union', async () => {
    await searchAndRerankQuestion(
      prisma,
      openAIService,
      rerankerService,
      'Question test',
      {
        enableRouting: false,
        corpusIds: ['code-penal'],
        retrievalStrategy: 'hybrid-union',
      },
    );

    expect(retrieveHybridUnionCandidatesMock).toHaveBeenCalled();
    expect(searchQuestionMock).not.toHaveBeenCalled();
    expect(rerankChunksMock).toHaveBeenCalledWith(
      rerankerService,
      'Question test',
      candidates,
      expect.any(Number),
      expect.any(Object),
    );
  });
});
