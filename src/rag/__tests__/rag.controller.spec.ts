import { HttpException, HttpStatus, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RagController } from '../rag.controller.js';
import { RagService } from '../rag.service.js';

describe('RagController', () => {
  let controller: RagController;
  const answer = vi.fn();

  beforeEach(async () => {
    answer.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RagController],
      providers: [{ provide: RagService, useValue: { answer } }],
    }).compile();

    controller = module.get(RagController);
  });

  it('returns the service response for a valid question', async () => {
    const payload = {
      question: 'Que pr?voit l�article 1240 du Code civil ?',
      answer: 'Réponse.',
      routing: {
        decision: 'routed' as const,
        corpusIds: ['code-civil'],
        fallbackToGlobal: false,
      },
      rerankStatus: 'success' as const,
      sources: [],
    };
    answer.mockResolvedValue(payload);

    await expect(
      controller.answer({ question: payload.question }),
    ).resolves.toEqual(payload);
    expect(answer).toHaveBeenCalledWith(payload.question);
  });

  it('rejects missing question via validation pipe', async () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });

    const { RagAnswerRequestDto } = await import(
      '../dto/rag-answer-request.dto.js'
    );

    await expect(
      pipe.transform({}, { type: 'body', metatype: RagAnswerRequestDto }),
    ).rejects.toMatchObject({
      response: {
        statusCode: HttpStatus.BAD_REQUEST,
      },
    });
  });

  it('rejects empty question after trim via validation pipe', async () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });

    const { RagAnswerRequestDto } = await import(
      '../dto/rag-answer-request.dto.js'
    );

    await expect(
      pipe.transform(
        { question: '   ' },
        { type: 'body', metatype: RagAnswerRequestDto },
      ),
    ).rejects.toMatchObject({
      response: {
        statusCode: HttpStatus.BAD_REQUEST,
      },
    });
  });

  it('propagates service errors', async () => {
    answer.mockRejectedValue(
      new HttpException(
        { error: 'ROUTING_API_ERROR', message: 'fail' },
        HttpStatus.BAD_GATEWAY,
      ),
    );

    await expect(
      controller.answer({ question: 'Question valide' }),
    ).rejects.toBeInstanceOf(HttpException);
  });
});
