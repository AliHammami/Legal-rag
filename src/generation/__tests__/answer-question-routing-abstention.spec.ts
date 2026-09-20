import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { OpenAIService } from '../../openai/openai.service.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { RerankerService } from '../../reranking/reranker.service.js';
import { answerQuestion } from '../answer-question.js';
import { ROUTING_ABSTENTION_ANSWER } from '../constants.js';
import type { RagGenerationService } from '../rag-generation.service.js';

const { searchAndRerankQuestionMock } = vi.hoisted(() => ({
  searchAndRerankQuestionMock: vi.fn(),
}));

vi.mock('../../reranking/search-and-rerank-question.js', () => ({
  searchAndRerankQuestion: searchAndRerankQuestionMock,
}));

describe('answerQuestion routing abstention', () => {
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
  });

  it('returns an abstention answer without calling generation for ambiguous routing', async () => {
    searchAndRerankQuestionMock.mockResolvedValue({
      candidates: [],
      reranked: [],
      rerankStatus: 'success',
      routing: {
        corpusIds: [],
        decision: 'abstain',
        fallbackToGlobal: false,
      },
    });

    const result = await answerQuestion(
      prisma,
      openAIService,
      rerankerService,
      generationService,
      'Quelles sont les r?gles applicables en cas de force majeure ?',
    );

    expect(generateAnswer).not.toHaveBeenCalled();
    expect(result.answer).toBe(ROUTING_ABSTENTION_ANSWER);
    expect(result.context).toBe('');
    expect(result.sources).toEqual([]);
    expect(result.profiling.generationCalls).toBe(0);
    expect(result.contextFiltering).toEqual({
      jinaResults: 0,
      contextResults: 0,
      relativeScoreThreshold: 0.4,
    });
  });

  it('returns an abstention answer without calling generation for out-of-scope routing', async () => {
    searchAndRerankQuestionMock.mockResolvedValue({
      candidates: [],
      reranked: [],
      rerankStatus: 'success',
      routing: {
        corpusIds: [],
        decision: 'abstain',
        fallbackToGlobal: false,
      },
    });

    const result = await answerQuestion(
      prisma,
      openAIService,
      rerankerService,
      generationService,
      'Quelles sont les conditions de la naturalisation fran?aise par mariage ?',
    );

    expect(generateAnswer).not.toHaveBeenCalled();
    expect(result.answer).toBe(ROUTING_ABSTENTION_ANSWER);
  });
});
