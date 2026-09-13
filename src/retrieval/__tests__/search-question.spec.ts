import { describe, expect, it, vi, beforeEach } from 'vitest';
import { EMBEDDING_DIMENSIONS } from '../../embeddings/constants.js';
import type { OpenAIService } from '../../openai/openai.service.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import { RetrievalError } from '../retrieval.error.js';
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

describe('searchQuestion', () => {
  const prisma = {} as PrismaService;
  let createEmbeddings: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    createEmbeddings = vi.fn().mockResolvedValue([
      { index: 0, embedding: queryVector() },
    ]);
    searchSimilarChunksMock.mockReset();
    searchSimilarChunksMock.mockResolvedValue(makeResults());
  });

  it('embeds a valid question and delegates to searchSimilarChunks', async () => {
    const openAIService = { createEmbeddings } as unknown as OpenAIService;
    const expectedResults = makeResults();

    const results = await searchQuestion(prisma, openAIService, QUESTION, 20);

    expect(createEmbeddings).toHaveBeenCalledWith([QUESTION]);
    expect(searchSimilarChunksMock).toHaveBeenCalledWith(
      prisma,
      queryVector(),
      20,
      {},
    );
    expect(results).toEqual(expectedResults);
  });

  it('trims the question before embedding', async () => {
    const openAIService = { createEmbeddings } as unknown as OpenAIService;

    await searchQuestion(prisma, openAIService, `  ${QUESTION}  `, 20);

    expect(createEmbeddings).toHaveBeenCalledWith([QUESTION]);
  });

  it('rejects an empty question without calling OpenAI or retrieval', async () => {
    const openAIService = { createEmbeddings } as unknown as OpenAIService;

    await expect(searchQuestion(prisma, openAIService, '', 20)).rejects.toThrow(
      RetrievalError,
    );
    expect(createEmbeddings).not.toHaveBeenCalled();
    expect(searchSimilarChunksMock).not.toHaveBeenCalled();
  });

  it('rejects a whitespace-only question without calling OpenAI or retrieval', async () => {
    const openAIService = { createEmbeddings } as unknown as OpenAIService;

    await expect(searchQuestion(prisma, openAIService, '     ', 20)).rejects.toThrow(
      RetrievalError,
    );
    expect(createEmbeddings).not.toHaveBeenCalled();
    expect(searchSimilarChunksMock).not.toHaveBeenCalled();
  });

  it('propagates OpenAI embedding errors', async () => {
    const openAIError = new Error('OpenAI rate limit');
    createEmbeddings.mockRejectedValue(openAIError);
    const openAIService = { createEmbeddings } as unknown as OpenAIService;

    await expect(searchQuestion(prisma, openAIService, QUESTION, 20)).rejects.toBe(
      openAIError,
    );
    expect(searchSimilarChunksMock).not.toHaveBeenCalled();
  });

  it('propagates retrieval errors from searchSimilarChunks', async () => {
    const retrievalError = new RetrievalError('Database unavailable', 'DB_ERROR');
    searchSimilarChunksMock.mockRejectedValue(retrievalError);
    const openAIService = { createEmbeddings } as unknown as OpenAIService;

    await expect(searchQuestion(prisma, openAIService, QUESTION, 20)).rejects.toBe(
      retrievalError,
    );
  });

  it('passes topK through to searchSimilarChunks', async () => {
    const openAIService = { createEmbeddings } as unknown as OpenAIService;

    await searchQuestion(prisma, openAIService, QUESTION, 5);
    expect(searchSimilarChunksMock).toHaveBeenCalledWith(
      prisma,
      queryVector(),
      5,
      {},
    );

    await searchQuestion(prisma, openAIService, QUESTION, 20);
    expect(searchSimilarChunksMock).toHaveBeenCalledWith(
      prisma,
      queryVector(),
      20,
      {},
    );
  });
});
