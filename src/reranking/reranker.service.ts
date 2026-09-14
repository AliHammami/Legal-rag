import type { RerankDocument, RerankResult } from './types.js';

export interface RerankOptions {
  topN?: number;
}

export interface RerankerService {
  rerank(
    query: string,
    documents: RerankDocument[],
    options?: RerankOptions,
  ): Promise<RerankResult[]>;
}

export const RERANKER_SERVICE = Symbol('RERANKER_SERVICE');
