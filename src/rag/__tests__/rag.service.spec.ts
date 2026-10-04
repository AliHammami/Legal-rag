import { HttpException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { answerQuestion } from '../../generation/answer-question.js';
import { RagGenerationService } from '../../generation/rag-generation.service.js';
import { createPipelineProfiling } from '../../profiling/pipeline-timings.js';
import { OpenAIErrorMapper } from '../../openai/openai-error.mapper.js';
import { OpenAIService } from '../../openai/openai.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { JinaRerankerService } from '../../reranking/jina-reranker.service.js';
import { RoutingError } from '../../routing/routing.error.js';
import { RagService } from '../rag.service.js';

vi.mock('../../generation/answer-question.js', () => ({
  answerQuestion: vi.fn(),
}));

describe('RagService', () => {
  let service: RagService;

  beforeEach(async () => {
    vi.mocked(answerQuestion).mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RagService,
        { provide: PrismaService, useValue: {} },
        { provide: OpenAIService, useValue: {} },
        { provide: JinaRerankerService, useValue: {} },
        { provide: RagGenerationService, useValue: {} },
        OpenAIErrorMapper,
      ],
    }).compile();

    service = module.get(RagService);
  });

  it('delegates to answerQuestion and maps the response', async () => {
    vi.mocked(answerQuestion).mockResolvedValue({
      question: 'Q',
      answer: 'A',
      routing: {
        decision: 'routed',
        corpusIds: ['code-civil'],
        fallbackToGlobal: false,
      },
      candidates: [],
      reranked: [],
      rerankStatus: 'success',
      contextFiltering: {
        jinaResults: 1,
        contextResults: 1,
        relativeScoreThreshold: 0.4,
      },
      context: '',
      sources: [],
      profiling: createPipelineProfiling(),
    });

    await expect(service.answer('Q')).resolves.toEqual({
      question: 'Q',
      answer: 'A',
      routing: {
        decision: 'routed',
        corpusIds: ['code-civil'],
        fallbackToGlobal: false,
      },
      rerankStatus: 'success',
      sources: [],
    });

    expect(answerQuestion).toHaveBeenCalledOnce();
  });

  it('maps pipeline errors to HttpException', async () => {
    vi.mocked(answerQuestion).mockRejectedValue(
      new RoutingError('Routing failed', 'ROUTING_API_ERROR'),
    );

    await expect(service.answer('Q')).rejects.toBeInstanceOf(HttpException);
  });
});
