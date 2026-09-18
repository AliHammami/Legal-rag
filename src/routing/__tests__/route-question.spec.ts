import { describe, expect, it, vi, beforeEach } from 'vitest';

import type { OpenAIService } from '../../openai/openai.service.js';
import { RoutingError } from '../routing.error.js';
import { routeQuestion } from '../route-question.js';

function mockOpenAI(response: unknown): OpenAIService {
  return {
    createStructuredChatCompletion: vi.fn().mockResolvedValue(response),
  } as unknown as OpenAIService;
}

describe('routeQuestion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    [
      'Quelles sont les conditions de la l?gitime d?fense ?',
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
      'Quelles r?gles encadrent les actes de commerce ?',
      { corpusIds: ['code-du-commerce'] },
      ['code-du-commerce'],
    ],
    [
      'Quelles r?gles concernent le cr?dit ? la consommation ?',
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
      reason: 'Question m?lant responsabilit? p?nale et civile.',
    });

    const result = await routeQuestion(
      openAIService,
      'Quelles cons?quences p?nales et civiles en cas de violences conjugales ?',
    );

    expect(result).toEqual({
      corpusIds: ['code-penal', 'code-civil'],
      reason: 'Question m?lant responsabilit? p?nale et civile.',
    });
  });

  it('accepts an empty corpusIds array for ambiguous questions', async () => {
    const openAIService = mockOpenAI({
      corpusIds: [],
      reason: 'Question trop g?n?rale.',
    });

    const result = await routeQuestion(
      openAIService,
      'Quelle est la loi en France ?',
    );

    expect(result.corpusIds).toEqual([]);
    expect(result.reason).toBe('Question trop g?n?rale.');
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
    const openAIService = {
      createStructuredChatCompletion: vi
        .fn()
        .mockRejectedValue(new Error('OpenAI returned empty structured response')),
    } as unknown as OpenAIService;

    await expect(routeQuestion(openAIService, 'Question test')).rejects.toBeInstanceOf(
      RoutingError,
    );
    await expect(routeQuestion(openAIService, 'Question test')).rejects.toMatchObject({
      code: 'ROUTING_RESPONSE_EMPTY',
    });
  });

  it('calls structured completion with router messages and schema', async () => {
    const createStructuredChatCompletion = vi
      .fn()
      .mockResolvedValue({ corpusIds: ['code-penal'] });
    const openAIService = {
      createStructuredChatCompletion,
    } as unknown as OpenAIService;

    await routeQuestion(openAIService, 'Question p?nale');

    expect(createStructuredChatCompletion).toHaveBeenCalledOnce();
    const call = createStructuredChatCompletion.mock.calls[0]?.[0];
    expect(call.schemaName).toBe('corpus_routing_result');
    expect(call.messages[0]?.content).toContain('code-penal');
    expect(call.messages[1]?.content).toBe('Question p?nale');
  });
});
