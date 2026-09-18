import type { OpenAIService } from '../openai/openai.service.js';
import { routeQuestion } from './route-question.js';
import type { RouteQuestionOptions, RoutingMetadata, RoutingResult } from './types.js';

export interface ResolvedRoutingForRetrieval {
  routing: RoutingMetadata;
  retrievalCorpusIds: string[] | undefined;
}

export function toRetrievalCorpusIds(
  routing: Pick<RoutingResult, 'corpusIds'>,
): string[] | undefined {
  return routing.corpusIds.length > 0 ? routing.corpusIds : undefined;
}

export function toRoutingMetadata(
  routing: Pick<RoutingResult, 'corpusIds'>,
): RoutingMetadata {
  return {
    corpusIds: routing.corpusIds,
    fallbackToGlobal: routing.corpusIds.length === 0,
  };
}

export async function resolveRoutingForRetrieval(
  openAIService: OpenAIService,
  question: string,
  options: RouteQuestionOptions = {},
): Promise<ResolvedRoutingForRetrieval> {
  const routing = await routeQuestion(openAIService, question, options);

  return {
    routing: toRoutingMetadata(routing),
    retrievalCorpusIds: toRetrievalCorpusIds(routing),
  };
}
