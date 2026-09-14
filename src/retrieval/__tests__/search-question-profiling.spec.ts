import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EMBEDDING_DIMENSIONS } from '../../embeddings/constants.js';
import { createPipelineProfiling } from '../../profiling/pipeline-timings.js';
import type { OpenAIService } from '../../openai/openai.service.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import { searchQuestion } from '../search-question.js';
import type { SimilarChunk } from '../types.js';

const { searchSimilarChunksMock } = vi.hoisted(() => ({
  searchSimilarChunksMock: vi.fn(),
}));

vi.mock('../search-similar-chunks.js', () => ({
  searchSimilarChunks: searchSimilarChunksMock,
}));

const QUESTION = 'Quelles sont les conditions de la légitime défense ?';

function queryVector(): number[] {
  return Array.from({ length: EMBEDDING_DIMENSIONS }, (_, i) => i * 0.0001);
}

function makeResults(): SimilarChunk[] {
  return [
    {
      chunkId: '122-5#0',
      articleNumber: '122-5',
      content: 'Contenu article 122-5',
      metadata: {
        articleNumber: '122-5',
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
      distance: 0.18,
    },
  ];
}

describe('searchQuestion profiling', () => {
  const prisma = {} as PrismaService;
  let createEmbeddings: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    createEmbeddings = vi.fn().mockResolvedValue([
      { index: 0, embedding: queryVector() },
    ]);
    searchSimilarChunksMock.mockReset();
    searchSimilarChunksMock.mockResolvedValue(makeResults());
  });

  it('records embedding and vector search metrics without changing results', async () => {
    const profiling = createPipelineProfiling();
    const openAIService = { createEmbeddings } as unknown as OpenAIService;
    const expectedResults = makeResults();

    const results = await searchQuestion(prisma, openAIService, QUESTION, 20, {
      profiling,
    });

    expect(results).toEqual(expectedResults);
    expect(profiling.embeddingMs).toBeGreaterThanOrEqual(0);
    expect(profiling.vectorSearchMs).toBeGreaterThanOrEqual(0);
    expect(profiling.embeddingCalls).toBe(1);
    expect(profiling.rerankingCalls).toBe(0);
    expect(profiling.rerankStatus).toBe('pending');
  });

  it('does not record metrics when profiling is omitted', async () => {
    const openAIService = { createEmbeddings } as unknown as OpenAIService;

    const results = await searchQuestion(prisma, openAIService, QUESTION, 20);

    expect(results).toEqual(makeResults());
  });
});
