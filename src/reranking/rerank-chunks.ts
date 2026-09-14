import { performance } from 'node:perf_hooks';

import type { OpenAIService } from '../openai/openai.service.js';
import type { SimilarChunk } from '../retrieval/types.js';
import {
  buildRerankMessages,
  buildRetryRerankMessages,
} from './build-rerank-prompt.js';
import {
  MAX_RERANK_ATTEMPTS,
  RERANK_RESPONSE_JSON_SCHEMA,
  RERANK_RESPONSE_SCHEMA_NAME,
  RERANKING_MODEL,
} from './constants.js';
import {
  applyRerankOrdering,
  parseRerankModelResponse,
} from './parse-rerank-response.js';
import type { RerankChunksOptions } from './rerank-chunks-options.js';
import { isRetryableRerankingError } from './reranking.error.js';
import type { RerankedChunk } from './types.js';
import { validateRerankingInput } from './validate-reranking-input.js';

function writeRerankProfiling(
  profiling: NonNullable<RerankChunksOptions['profiling']>,
  values: {
    rerankingOpenAiMs: number;
    parsingValidationMs: number;
    rerankingCalls: number;
    rerankAttempts: number;
  },
): void {
  profiling.rerankingOpenAiMs = values.rerankingOpenAiMs;
  profiling.parsingValidationMs = values.parsingValidationMs;
  profiling.rerankingCalls = values.rerankingCalls;
  profiling.rerankAttempts = values.rerankAttempts;
}

export async function rerankChunks(
  openAIService: OpenAIService,
  question: string,
  chunks: SimilarChunk[],
  topK: number,
  options: RerankChunksOptions = {},
): Promise<RerankedChunk[]> {
  const normalizedQuestion = validateRerankingInput(question, chunks, topK);
  const { profiling } = options;
  let rerankingOpenAiMs = 0;
  let parsingValidationMs = 0;
  let rerankingCalls = 0;

  for (let attempt = 0; attempt < MAX_RERANK_ATTEMPTS; attempt++) {
    const { system, user } =
      attempt === 0
        ? buildRerankMessages(normalizedQuestion, chunks)
        : buildRetryRerankMessages(normalizedQuestion, chunks);

    try {
      const rerankStart = performance.now();
      let rawResponse: unknown;
      try {
        rawResponse =
          await openAIService.createStructuredChatCompletion<unknown>({
            model: RERANKING_MODEL,
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: user },
            ],
            schemaName: RERANK_RESPONSE_SCHEMA_NAME,
            schema: RERANK_RESPONSE_JSON_SCHEMA,
          });
        rerankingCalls += 1;
      } finally {
        rerankingOpenAiMs += performance.now() - rerankStart;
      }

      const parseStart = performance.now();
      let reranked: RerankedChunk[];
      try {
        const parsedResponse = parseRerankModelResponse(rawResponse);
        reranked = applyRerankOrdering(chunks, parsedResponse, topK);
      } finally {
        parsingValidationMs += performance.now() - parseStart;
      }

      if (profiling) {
        writeRerankProfiling(profiling, {
          rerankingOpenAiMs,
          parsingValidationMs,
          rerankingCalls,
          rerankAttempts: attempt + 1,
        });
      }

      return reranked;
    } catch (error) {
      const hasRetryRemaining = attempt < MAX_RERANK_ATTEMPTS - 1;
      if (isRetryableRerankingError(error) && hasRetryRemaining) {
        if (profiling) {
          writeRerankProfiling(profiling, {
            rerankingOpenAiMs,
            parsingValidationMs,
            rerankingCalls,
            rerankAttempts: attempt + 1,
          });
        }
        console.log('Reranking response invalid, retrying...');
        continue;
      }

      if (profiling) {
        writeRerankProfiling(profiling, {
          rerankingOpenAiMs,
          parsingValidationMs,
          rerankingCalls,
          rerankAttempts: attempt + 1,
        });
      }

      throw error;
    }
  }

  throw new Error('rerankChunks exhausted attempts without returning');
}
