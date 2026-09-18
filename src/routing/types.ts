export interface CorpusRoutingDescription {
  id: string;
  codeName: string;
  description: string;
}

export interface RoutingResult {
  corpusIds: string[];
  reason?: string;
}

export interface RouteQuestionOptions {
  model?: string;
  signal?: AbortSignal;
}

export interface RoutingRawResponse {
  corpusIds: unknown;
  reason?: unknown;
}
