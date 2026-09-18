import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OpenAIService } from '../../openai/openai.service.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { RerankerService } from '../../reranking/reranker.service.js';
import { answerQuestion } from '../answer-question.js';
import type { RagGenerationService } from '../rag-generation.service.js';

const { searchAndRerankQuestionMock } = vi.hoisted(() => ({
  searchAndRerankQuestionMock: vi.fn(),
}));

vi.mock('../../reranking/search-and-rerank-question.js', () => ({
  searchAndRerankQuestion: searchAndRerankQuestionMock,
}));

function makeChunk(chunkId: string, rerankScore: number) {
  return {
    corpusId: 'code-penal',
    chunkId,
    articleNumber: chunkId.split('#')[0] ?? chunkId,
    content: `Content for ${chunkId}`,
    distance: 0.2,
    rerankScore,
    metadata: {
      articleNumber: chunkId.split('#')[0] ?? chunkId,
      pageStart: 1,
      pageEnd: 1,
      source: 'data/code-penal.pdf',
      sourceType: 'pdf' as const,
      chunkIndex: 0,
      chunkCount: 1,
      unitStart: 0,
      unitEnd: 0,
      unitCount: 1,
    },
  };
}

const q001RerankedChunks = [
  makeChunk('122-6#0', 0.2965),
  makeChunk('122-5#0', 0.1197),
  makeChunk('462-9#0', 0.0591),
  makeChunk('462-11#0', 0.0269),
  makeChunk('122-7#0', 0.0261),
];

describe('answerQuestion', () => {
  const prisma = {} as PrismaService;
  const openAIService = {} as OpenAIService;
  const rerankerService = {} as RerankerService;
  const generateAnswer = vi.fn();
  const generationService = {
    generateAnswer,
  } as unknown as RagGenerationService;

  beforeEach(() => {
    searchAndRerankQuestionMock.mockReset();
    generateAnswer.mockReset();
    searchAndRerankQuestionMock.mockResolvedValue({
      candidates: q001RerankedChunks,
      reranked: q001RerankedChunks,
      rerankStatus: 'success',
    });
    generateAnswer.mockResolvedValue('Réponse finale.');
  });

  it('orchestrates retrieval, dynamic filtering, context building, and generation', async () => {
    const result = await answerQuestion(
      prisma,
      openAIService,
      rerankerService,
      generationService,
      'Quelles sont les conditions de la légitime défense ?',
    );

    expect(searchAndRerankQuestionMock).toHaveBeenCalledTimes(1);
    expect(generateAnswer).toHaveBeenCalledWith(
      expect.objectContaining({
        question: 'Quelles sont les conditions de la légitime défense ?',
        context: expect.stringContaining('[Source 1 — Article 122-6 — chunk 0]'),
      }),
    );
    expect(result.answer).toBe('Réponse finale.');
    expect(result.contextFiltering).toEqual({
      jinaResults: 5,
      contextResults: 2,
      relativeScoreThreshold: 0.4,
    });
    expect(result.sources.map((source) => source.articleNumber)).toEqual([
      '122-6',
      '122-5',
    ]);
    expect(result.reranked).toHaveLength(5);
    expect(result.profiling.generationCalls).toBe(1);
    expect(result.profiling.contextFilteringMs).toBeGreaterThanOrEqual(0);
    expect(result.profiling.contextBuilderMs).toBeGreaterThanOrEqual(0);
    expect(result.profiling.answerPipelineTotalMs).toBeGreaterThanOrEqual(0);
  });

  it('passes only filtered chunks to the context builder for q001', async () => {
    const result = await answerQuestion(
      prisma,
      openAIService,
      rerankerService,
      generationService,
      'Quelles sont les conditions de la légitime défense ?',
    );

    expect(result.sources).toHaveLength(2);
    expect(result.context).toContain('Article 122-6');
    expect(result.context).toContain('Article 122-5');
    expect(result.context).not.toContain('Article 462-9');
    expect(result.context).not.toContain('Article 462-11');
    expect(result.context).not.toContain('Article 122-7');
  });
});
