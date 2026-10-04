import { RunnableLambda } from '@langchain/core/runnables';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import type { OpenAIService } from '../../openai/openai.service.js';
import { RoutingError } from '../routing.error.js';
import { routeQuestion } from '../route-question.js';

function mockStructuredRoutingModel(response: unknown) {
  const invoke = vi.fn().mockResolvedValue(response);
  return RunnableLambda.from(invoke);
}

function mockOpenAI(response: unknown): OpenAIService {
  const structuredModel = mockStructuredRoutingModel(response);
  return {
    createChatModel: vi.fn().mockReturnValue({
      withStructuredOutput: vi.fn().mockReturnValue(structuredModel),
    }),
  } as unknown as OpenAIService;
}

describe('routeQuestion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    [
      'Quelles sont les conditions de la légitime défense ?',
      { corpusIds: ['code-penal'] },
      ['code-penal'],
    ],
    [
      'Quelles sont les conditions de validit? d\'un contrat ?',
      { corpusIds: ['code-civil'] },
      ['code-civil'],
    ],
    [
      'Un employeur peut-il licencier un salari? pour faute grave ?',
      { corpusIds: ['code-du-travail'] },
      ['code-du-travail'],
    ],
    [
      'Quelles règles encadrent les actes de commerce ?',
      { corpusIds: ['code-du-commerce'] },
      ['code-du-commerce'],
    ],
    [
      'Quelles règles concernent le crédit à la consommation ?',
      { corpusIds: ['code-de-la-consommation'] },
      ['code-de-la-consommation'],
    ],
    [
      'Quelles sont les obligations d\'une banque concernant la lutte contre le blanchiment ?',
      { corpusIds: ['code-monetaire-et-financier'] },
      ['code-monetaire-et-financier'],
    ],
  ])('routes "%s" to expected corpus', async (_question, llmResponse, expected) => {
    const openAIService = mockOpenAI(llmResponse);
    const result = await routeQuestion(openAIService, _question);
    expect(result.corpusIds).toEqual(expected);
  });

  it('accepts multiple corpora when the LLM selects several', async () => {
    const openAIService = mockOpenAI({
      corpusIds: ['code-penal', 'code-civil'],
      reason: 'Question mêlant responsabilité pénale et civile.',
    });

    const result = await routeQuestion(
      openAIService,
      'Quelles conséquences pénales et civiles en cas de violences conjugales ?',
    );

    expect(result).toEqual({
      corpusIds: ['code-penal', 'code-civil'],
      reason: 'Question mêlant responsabilité pénale et civile.',
    });
  });

  it('accepts an empty corpusIds array for ambiguous questions', async () => {
    const openAIService = mockOpenAI({
      corpusIds: [],
      reason: 'Question trop générale.',
    });

    const result = await routeQuestion(
      openAIService,
      'Quelle est la loi en France ?',
    );

    expect(result.corpusIds).toEqual([]);
    expect(result.reason).toBe('Question trop générale.');
  });

  it('rejects unknown corpus IDs returned by the LLM', async () => {
    const openAIService = mockOpenAI({ corpusIds: ['unknown-corpus'] });

    await expect(
      routeQuestion(openAIService, 'Question test'),
    ).rejects.toMatchObject({
      code: 'ROUTING_UNKNOWN_CORPUS',
    });
  });

  it('rejects invalid LLM payloads before returning', async () => {
    const openAIService = mockOpenAI({ corpusIds: 'code-penal' });

    await expect(routeQuestion(openAIService, 'Question test')).rejects.toMatchObject({
      code: 'ROUTING_INVALID',
    });
  });

  it('rejects empty questions', async () => {
    const openAIService = mockOpenAI({ corpusIds: ['code-penal'] });

    await expect(routeQuestion(openAIService, '   ')).rejects.toMatchObject({
      code: 'QUESTION_EMPTY',
    });
  });

  it('maps OpenAI API errors to RoutingError', async () => {
    const invoke = vi.fn().mockRejectedValue(new Error('OpenAI rate limit'));
    const structuredModel = RunnableLambda.from(invoke);
    const openAIService = {
      createChatModel: vi.fn().mockReturnValue({
        withStructuredOutput: vi.fn().mockReturnValue(structuredModel),
      }),
    } as unknown as OpenAIService;

    await expect(routeQuestion(openAIService, 'Question test')).rejects.toBeInstanceOf(
      RoutingError,
    );
  });

  it('invokes routing LCEL chain with router prompt variables', async () => {
    const invoke = vi.fn().mockResolvedValue({ corpusIds: ['code-penal'] });
    const structuredModel = RunnableLambda.from(invoke);
    const withStructuredOutput = vi.fn().mockReturnValue(structuredModel);
    const createChatModel = vi.fn().mockReturnValue({ withStructuredOutput });
    const openAIService = { createChatModel } as unknown as OpenAIService;

    await routeQuestion(openAIService, 'Question pénale');

    expect(createChatModel).toHaveBeenCalledOnce();
    expect(withStructuredOutput).toHaveBeenCalledOnce();
    expect(invoke).toHaveBeenCalledOnce();
    const promptArg = invoke.mock.calls[0]?.[0];
    expect(promptArg).toBeDefined();
    const messages = promptArg.toChatMessages();
    expect(String(messages[0]?.content)).toContain('code-penal');
    expect(messages[1]?.content).toBe('Question pénale');
  });
});
