import { RerankingError } from './reranking.error.js';
import type { RerankDocument, RerankResult } from './types.js';

export interface JinaRerankApiResult {
  index: number;
  relevance_score: number;
}

export interface JinaRerankApiResponse {
  results?: JinaRerankApiResult[];
}

export function mapJinaResultsToRerankResults(
  documents: RerankDocument[],
  response: JinaRerankApiResponse,
): RerankResult[] {
  if (!Array.isArray(response.results)) {
    throw new RerankingError(
      'Invalid Jina reranking response: results missing',
      'RESPONSE_INVALID',
    );
  }

  if (response.results.length === 0) {
    throw new RerankingError(
      'Invalid Jina reranking response: results is empty',
      'RESPONSE_INVALID',
    );
  }

  return response.results.map((item, resultIndex) => {
    if (!Number.isInteger(item.index) || item.index < 0) {
      throw new RerankingError(
        `Invalid Jina result at position ${resultIndex}: index must be a non-negative integer`,
        'RESPONSE_INVALID',
      );
    }

    if (item.index >= documents.length) {
      throw new RerankingError(
        `Invalid Jina result at position ${resultIndex}: index ${item.index} out of range`,
        'RESPONSE_INVALID',
      );
    }

    if (typeof item.relevance_score !== 'number' || !Number.isFinite(item.relevance_score)) {
      throw new RerankingError(
        `Invalid Jina result at position ${resultIndex}: relevance_score must be a finite number`,
        'RESPONSE_INVALID',
      );
    }

    const document = documents[item.index]!;
    return {
      chunkId: document.chunkId,
      score: item.relevance_score,
    };
  });
}
