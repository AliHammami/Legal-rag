import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  JINA_RERANKER_API_URL,
  JINA_RERANKER_MODEL,
} from './constants.js';
import { mapJinaResultsToRerankResults } from './map-jina-response.js';
import type { RerankOptions, RerankerService } from './reranker.service.js';
import { RerankingError } from './reranking.error.js';
import type { RerankDocument, RerankResult } from './types.js';

export type FetchLike = typeof fetch;

export interface JinaRerankRequestBody {
  model: string;
  query: string;
  documents: string[];
  top_n?: number;
  return_documents: boolean;
}

@Injectable()
export class JinaRerankerService implements RerankerService {
  private readonly fetchFn: FetchLike;

  constructor(
    @Inject(ConfigService) private readonly configService: ConfigService,
    fetchFn: FetchLike = fetch,
  ) {
    this.fetchFn = fetchFn;
  }

  async rerank(
    query: string,
    documents: RerankDocument[],
    options: RerankOptions = {},
  ): Promise<RerankResult[]> {
    if (documents.length === 0) {
      throw new RerankingError(
        'At least one document is required for reranking',
        'DOCUMENTS_EMPTY',
      );
    }

    const apiKey = this.configService.get<string>('JINA_API_KEY');
    if (!apiKey) {
      throw new RerankingError(
        'JINA_API_KEY is not configured',
        'CONFIG_MISSING',
      );
    }

    const body: JinaRerankRequestBody = {
      model: JINA_RERANKER_MODEL,
      query,
      documents: documents.map((document) => document.content),
      return_documents: false,
    };

    if (options.topN !== undefined) {
      body.top_n = options.topN;
    }

    let response: Response;
    try {
      response = await this.fetchFn(JINA_RERANKER_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
    } catch (error) {
      throw new RerankingError(
        'Network error while calling Jina reranker API',
        'NETWORK_ERROR',
        error,
      );
    }

    const responseText = await response.text();
    if (!response.ok) {
      throw new RerankingError(
        `Jina reranker API returned HTTP ${response.status}`,
        'API_ERROR',
        responseText,
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(responseText);
    } catch (error) {
      throw new RerankingError(
        'Invalid JSON in Jina reranker API response',
        'RESPONSE_INVALID',
        error,
      );
    }

    return mapJinaResultsToRerankResults(documents, parsed as never);
  }
}
