import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import type { OpenAIService } from '../../openai/openai.service.js';
import { RAG_SYSTEM_PROMPT } from '../build-rag-messages.js';
import { DEFAULT_RAG_GENERATION_MODEL } from '../constants.js';
import { GenerationError } from '../generation.error.js';
import { RagGenerationService } from '../rag-generation.service.js';

describe('RagGenerationService', () => {
  let configService: ConfigService;
  let createChatCompletion: ReturnType<typeof vi.fn>;
  let service: RagGenerationService;

  beforeEach(() => {
    configService = {
      get: vi.fn().mockReturnValue(undefined),
    } as unknown as ConfigService;
    createChatCompletion = vi.fn().mockResolvedValue('Réponse générée.');
    const openAIService = {
      createChatCompletion,
    } as unknown as OpenAIService;
    service = new RagGenerationService(configService, openAIService);
  });

  it('uses the configured generation model', async () => {
    configService.get = vi.fn().mockReturnValue('gpt-test-model');

    await service.generateAnswer({
      question: 'Question ?',
      context: 'Contexte',
    });

    expect(createChatCompletion).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gpt-test-model' }),
    );
  });

  it('falls back to the default model when env is unset', async () => {
    await service.generateAnswer({
      question: 'Question ?',
      context: 'Contexte',
    });

    expect(createChatCompletion).toHaveBeenCalledWith(
      expect.objectContaining({ model: DEFAULT_RAG_GENERATION_MODEL }),
    );
  });

  it('passes system prompt, context, and question to OpenAI', async () => {
    await service.generateAnswer({
      question: 'Question ?',
      context: 'Contexte juridique',
    });

    const messages = createChatCompletion.mock.calls[0]?.[0].messages;
    expect(messages[0]?.content).toBe(RAG_SYSTEM_PROMPT);
    expect(messages[1]?.content).toContain('Contexte juridique');
    expect(messages[1]?.content).toContain('Question ?');
  });

  it('returns the generated answer', async () => {
    const answer = await service.generateAnswer({
      question: 'Question ?',
      context: 'Contexte',
    });

    expect(answer).toBe('Réponse générée.');
  });

  it('wraps OpenAI API errors', async () => {
    createChatCompletion.mockRejectedValue(new Error('rate limit'));

    await expect(
      service.generateAnswer({ question: 'Question ?', context: 'Contexte' }),
    ).rejects.toMatchObject({
      name: 'GenerationError',
      code: 'API_ERROR',
    });
  });

  it('wraps empty OpenAI responses', async () => {
    createChatCompletion.mockRejectedValue(
      new Error('OpenAI returned empty chat completion'),
    );

    await expect(
      service.generateAnswer({ question: 'Question ?', context: 'Contexte' }),
    ).rejects.toMatchObject({
      name: 'GenerationError',
      code: 'RESPONSE_EMPTY',
    });
  });
});
