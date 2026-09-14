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
import { isRetryableRerankingError } from './reranking.error.js';
import type { RerankedChunk } from './types.js';
import { validateRerankingInput } from './validate-reranking-input.js';

export async function rerankChunks(
  openAIService: OpenAIService,
  question: string,
  chunks: SimilarChunk[],
  topK: number,
): Promise<RerankedChunk[]> {
  const normalizedQuestion = validateRerankingInput(question, chunks, topK);

  for (let attempt = 0; attempt < MAX_RERANK_ATTEMPTS; attempt++) {
    const { system, user } =
      attempt === 0
        ? buildRerankMessages(normalizedQuestion, chunks)
        : buildRetryRerankMessages(normalizedQuestion, chunks);

    try {
      const rawResponse =
        await openAIService.createStructuredChatCompletion<unknown>({
          model: RERANKING_MODEL,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          schemaName: RERANK_RESPONSE_SCHEMA_NAME,
          schema: RERANK_RESPONSE_JSON_SCHEMA,
        });

      const parsedResponse = parseRerankModelResponse(rawResponse);
      return applyRerankOrdering(chunks, parsedResponse, topK);
    } catch (error) {
      const hasRetryRemaining = attempt < MAX_RERANK_ATTEMPTS - 1;
      if (isRetryableRerankingError(error) && hasRetryRemaining) {
        console.log('Reranking response invalid, retrying...');
        continue;
      }

      throw error;
    }
  }

  throw new Error('rerankChunks exhausted attempts without returning');
}
