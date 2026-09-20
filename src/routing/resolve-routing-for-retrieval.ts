import type { OpenAIService } from '../openai/openai.service.js';
import { routeQuestion } from './route-question.js';
import type {
  RouteQuestionOptions,
  RoutingMetadata,
  RoutingResult,
} from './types.js';

export interface ResolvedRoutingForRetrieval {
  routing: RoutingMetadata;
  /** Undefined when the router abstains; otherwise corpus filter for retrieval. */
  retrievalCorpusIds?: string[];
  abstain: boolean;
}

export function routingMetadataFromRouterResult(
  routing: Pick<RoutingResult, 'corpusIds'>,
): RoutingMetadata {
  if (routing.corpusIds.length > 0) {
    return {
      corpusIds: routing.corpusIds,
      decision: 'routed',
      fallbackToGlobal: false,
    };
  }

  return {
    corpusIds: [],
    decision: 'abstain',
    fallbackToGlobal: false,
  };
}

export function routingMetadataFromExplicitCorpusIds(
  corpusIds: string[],
): RoutingMetadata {
  if (corpusIds.length > 0) {
    return {
      corpusIds,
      decision: 'routed',
      fallbackToGlobal: false,
    };
  }

  return {
    corpusIds: [],
    decision: 'global_fallback',
    fallbackToGlobal: true,
  };
}

export function resolveRoutingFromRouterResult(
  routing: Pick<RoutingResult, 'corpusIds'>,
): ResolvedRoutingForRetrieval {
  const metadata = routingMetadataFromRouterResult(routing);

  if (metadata.decision === 'abstain') {
    return {
      routing: metadata,
      abstain: true,
    };
  }

  return {
    routing: metadata,
    retrievalCorpusIds: routing.corpusIds,
    abstain: false,
  };
}

export async function resolveRoutingForRetrieval(
  openAIService: OpenAIService,
  question: string,
  options: RouteQuestionOptions = {},
): Promise<ResolvedRoutingForRetrieval> {
  const routing = await routeQuestion(openAIService, question, options);
  return resolveRoutingFromRouterResult(routing);
}
