import { RetrievalError } from '../retrieval/retrieval.error.js';
import type { SimilarChunk } from '../retrieval/types.js';
import { validateQuestion } from '../retrieval/validate-search-input.js';
import { RerankingError } from './reranking.error.js';

export function validateRerankingInput(
  question: unknown,
  chunks: SimilarChunk[],
  topK: number,
): string {
  let normalizedQuestion: string;
  try {
    normalizedQuestion = validateQuestion(question);
  } catch (error) {
    if (error instanceof RetrievalError) {
      throw new RerankingError(error.message, error.code, error);
    }
    throw error;
  }

  if (chunks.length === 0) {
    throw new RerankingError('At least one chunk is required', 'CHUNKS_EMPTY');
  }

  if (!Number.isInteger(topK) || topK < 1) {
    throw new RerankingError(
      `Invalid topK: ${topK} (expected a positive integer)`,
      'TOP_K_INVALID',
    );
  }

  if (topK > chunks.length) {
    throw new RerankingError(
      `topK too large: ${topK} (max ${chunks.length})`,
      'TOP_K_TOO_LARGE',
    );
  }

  return normalizedQuestion;
}
