import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPipelineProfiling } from '../../profiling/pipeline-timings.js';
import type { OpenAIService } from '../../openai/openai.service.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { SimilarChunk } from '../../retrieval/types.js';
import { searchAndRerankQuestion } from '../search-and-rerank-question.js';

const { searchQuestionMock, rerankChunksMock } = vi.hoisted(() => ({
  searchQuestionMock: vi.fn(),
  rerankChunksMock: vi.fn(),
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

describe('searchAndRerankQuestion profiling', () => {
  const prisma = {} as PrismaService;
  const openAIService = {} as OpenAIService;
  const candidates = [makeChunk('122-5#0'), makeChunk('122-6#0')];
  const reranked = [makeChunk('122-6#0')];

  beforeEach(() => {
    searchQuestionMock.mockReset();
    rerankChunksMock.mockReset();
    searchQuestionMock.mockResolvedValue(candidates);
    rerankChunksMock.mockResolvedValue(reranked);
  });

  it('passes profiling to search and rerank and records total time', async () => {
    const profiling = createPipelineProfiling();

    const result = await searchAndRerankQuestion(
      prisma,
      openAIService,
      QUESTION,
      { profiling },
    );

    expect(result.candidates).toEqual(candidates);
    expect(result.reranked).toEqual(reranked);
    expect(searchQuestionMock).toHaveBeenCalledWith(
      prisma,
      openAIService,
      QUESTION,
      20,
      { profiling },
    );
    expect(rerankChunksMock).toHaveBeenCalledWith(
      openAIService,
      QUESTION,
      candidates,
      5,
      { profiling },
    );
    expect(profiling.totalMs).toBeGreaterThanOrEqual(0);
  });
});
