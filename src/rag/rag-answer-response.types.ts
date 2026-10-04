import type { RoutingDecision } from '../routing/types.js';
import type { RerankStatus } from '../reranking/types.js';

export interface RagAnswerSourceResponse {
  sourceId: number;
  codeName: string;
  articleNumber: string;
  chunkIndex: number;
}

export interface RagAnswerRoutingResponse {
  decision: RoutingDecision;
  corpusIds: string[];
  fallbackToGlobal: boolean;
}

export interface RagAnswerResponse {
  question: string;
  answer: string;
  routing: RagAnswerRoutingResponse | null;
  rerankStatus: RerankStatus;
  sources: RagAnswerSourceResponse[];
}
