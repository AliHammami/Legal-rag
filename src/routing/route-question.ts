import type { OpenAIService } from '../openai/openai.service.js';
import { OpenAIErrorMapper } from '../openai/openai-error.mapper.js';
import { RetrievalError } from '../retrieval/retrieval.error.js';
import { validateQuestion } from '../retrieval/validate-search-input.js';
import { CORPUS_ROUTING_DESCRIPTIONS } from './corpus-descriptions.js';
import { DEFAULT_ROUTING_MODEL } from './constants.js';
import { createRouterRoutingChain } from './langchain/create-router-routing-chain.js';
import { buildRouterPromptInput } from './langchain/router-chat-prompt.js';
import { RoutingLlmResponseSchema } from './routing-llm-response.schema.js';
import { RoutingError } from './routing.error.js';
import type { RouteQuestionOptions, RoutingResult } from './types.js';
import { validateRoutingResult } from './validate-routing-result.js';

export async function routeQuestion(
  openAIService: OpenAIService,
  question: string,
  options: RouteQuestionOptions = {},
): Promise<RoutingResult> {
  let normalizedQuestion: string;
  try {
    normalizedQuestion = validateQuestion(question);
  } catch (error) {
    if (error instanceof RetrievalError) {
      throw new RoutingError(error.message, error.code, error);
    }
    throw error;
  }
  const model = options.model ?? DEFAULT_ROUTING_MODEL;

  if (!model.trim()) {
    throw new RoutingError('Routing model is not configured', 'CONFIG_MISSING');
  }

  let rawResponse: unknown;
  try {
    const chatModel = openAIService.createChatModel(model);
    const structuredModel = chatModel.withStructuredOutput(
      RoutingLlmResponseSchema,
    );
    const routingChain = createRouterRoutingChain(structuredModel);
    rawResponse = await routingChain.invoke(
      buildRouterPromptInput(normalizedQuestion, CORPUS_ROUTING_DESCRIPTIONS),
      { signal: options.signal },
    );
  } catch (error) {
    if (error instanceof RoutingError) {
      throw error;
    }

    if (error instanceof Error) {
      const mapper = new OpenAIErrorMapper();
      const mapped = mapper.map(error);
      throw new RoutingError(mapped.message, mapped.code, error);
    }

    throw new RoutingError(
      'Unexpected error during corpus routing',
      'ROUTING_API_ERROR',
      error,
    );
  }

  try {
    return validateRoutingResult(rawResponse);
  } catch (error) {
    if (error instanceof RoutingError) {
      throw error;
    }

    throw new RoutingError(
      'Unable to validate routing response',
      'ROUTING_INVALID',
      error,
    );
  }
}
