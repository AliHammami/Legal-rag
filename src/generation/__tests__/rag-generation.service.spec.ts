import { AIMessage } from '@langchain/core/messages';
import { RunnableLambda } from '@langchain/core/runnables';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import { RAG_SYSTEM_PROMPT } from '../build-rag-messages.js';
import { DEFAULT_RAG_GENERATION_MODEL } from '../constants.js';
import { GenerationError } from '../generation.error.js';
import { RagGenerationService } from '../rag-generation.service.js';
import * as ragChatModelModule from '../langchain/create-rag-chat-model.js';
import { RAG_GENERATION_CHAT_PROMPT } from '../langchain/rag-generation-chat-prompt.js';

describe('RagGenerationService', () => {
  let configService: ConfigService;
  let invoke: ReturnType<typeof vi.fn>;
  let service: RagGenerationService;

  beforeEach(() => {
    configService = {
      get: vi.fn().mockReturnValue(undefined),
      getOrThrow: vi.fn().mockReturnValue('test-api-key'),
    } as unknown as ConfigService;
    invoke = vi.fn().mockResolvedValue(new AIMessage('Réponse générée.'));
    vi.spyOn(ragChatModelModule, 'createRagChatModel').mockReturnValue(
      RunnableLambda.from(invoke) as unknown as ReturnType<
        typeof ragChatModelModule.createRagChatModel
      >,
    );
    service = new RagGenerationService(configService);
  });

  it('uses the configured generation model', async () => {
    configService.get = vi.fn().mockReturnValue('gpt-test-model');

    await service.generateAnswer({
      question: 'Question ?',
      context: 'Contexte',
    });

    expect(ragChatModelModule.createRagChatModel).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gpt-test-model' }),
    );
  });

  it('falls back to the default model when env is unset', async () => {
    await service.generateAnswer({
      question: 'Question ?',
      context: 'Contexte',
    });

    expect(ragChatModelModule.createRagChatModel).toHaveBeenCalledWith(
      expect.objectContaining({ model: DEFAULT_RAG_GENERATION_MODEL }),
    );
  });

  it('passes ChatPromptTemplate output to ChatOpenAI.invoke', async () => {
    await service.generateAnswer({
      question: 'Question ?',
      context: 'Contexte juridique',
    });

    const promptArg = invoke.mock.calls[0]?.[0];
    expect(promptArg).toBeDefined();
    const messages = promptArg.toChatMessages();
    expect(messages[0]?.content).toBe(RAG_SYSTEM_PROMPT);
    expect(messages[1]?.content).toContain('Contexte juridique');
    expect(messages[1]?.content).toContain('Question ?');
  });

  it('runs the generation LCEL chain end-to-end via chain.invoke input', async () => {
    await service.generateAnswer({
      question: 'Ma question',
      context: 'Mon contexte',
    });

    expect(invoke).toHaveBeenCalledOnce();
    const promptArg = invoke.mock.calls[0]?.[0];
    const messages = promptArg.toChatMessages();
    expect(messages[1]?.content).toContain('Ma question');
    expect(messages[1]?.content).toContain('Mon contexte');
  });

  it('returns the generated answer', async () => {
    const answer = await service.generateAnswer({
      question: 'Question ?',
      context: 'Contexte',
    });

    expect(answer).toBe('Réponse générée.');
  });

  it('forwards abort signal to model.invoke', async () => {
    const controller = new AbortController();
    await service.generateAnswer({
      question: 'Question ?',
      context: 'Contexte',
      signal: controller.signal,
    });

    expect(invoke).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ signal: controller.signal }),
    );
  });

  it('wraps LangChain / API errors', async () => {
    invoke.mockRejectedValue(new Error('rate limit'));

    await expect(
      service.generateAnswer({ question: 'Question ?', context: 'Contexte' }),
    ).rejects.toMatchObject({
      name: 'GenerationError',
      code: 'API_ERROR',
    });
  });

  it('wraps empty model responses', async () => {
    invoke.mockResolvedValue(new AIMessage('   '));

    await expect(
      service.generateAnswer({ question: 'Question ?', context: 'Contexte' }),
    ).rejects.toMatchObject({
      name: 'GenerationError',
      code: 'RESPONSE_EMPTY',
    });
  });
});
