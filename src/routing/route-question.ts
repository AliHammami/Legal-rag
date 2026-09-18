import type { OpenAIService } from '../openai/openai.service.js';
import { OpenAIErrorMapper } from '../openai/openai-error.mapper.js';
import { RetrievalError } from '../retrieval/retrieval.error.js';
import { validateQuestion } from '../retrieval/validate-search-input.js';
import { CORPUS_ROUTING_DESCRIPTIONS } from './corpus-descriptions.js';
import {
  DEFAULT_ROUTING_MODEL,
  ROUTING_RESPONSE_SCHEMA,
} from './constants.js';
import { buildRouterMessages } from './router-prompt.js';
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

  const messages = buildRouterMessages(
    normalizedQuestion,
    CORPUS_ROUTING_DESCRIPTIONS,
  );

  let rawResponse: unknown;
  try {
    rawResponse = await openAIService.createStructuredChatCompletion<unknown>({
      model,
      messages,
      schemaName: 'corpus_routing_result',
      schema: ROUTING_RESPONSE_SCHEMA,
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof RoutingError) {
      throw error;
    }

    if (error instanceof Error) {
      if (error.message.includes('empty structured response')) {
        throw new RoutingError(
          'OpenAI returned an empty routing response',
          'ROUTING_RESPONSE_EMPTY',
          error,
        );
      }

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
