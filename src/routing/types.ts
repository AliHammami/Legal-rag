export interface CorpusRoutingDescription {
  id: string;
  codeName: string;
  description: string;
}

export interface RoutingResult {
  corpusIds: string[];
  reason?: string;
}

export type RoutingDecision = 'routed' | 'abstain' | 'global_fallback';

export interface RoutingMetadata {
  corpusIds: string[];
  decision: RoutingDecision;
  /** True only when retrieval intentionally runs globally (explicit empty selection). */
  fallbackToGlobal: boolean;
}

export function isRoutingAbstain(routing?: RoutingMetadata): boolean {
  return routing?.decision === 'abstain';
}

export interface RouteQuestionOptions {
  model?: string;
  signal?: AbortSignal;
}

export interface RoutingRawResponse {
  corpusIds: unknown;
  reason?: unknown;
}
