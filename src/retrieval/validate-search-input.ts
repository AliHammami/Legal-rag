import { EMBEDDING_DIMENSIONS } from '../embeddings/constants.js';
import { EmbeddingPipelineError } from '../embeddings/embedding-pipeline.error.js';
import { validateEmbeddingVector } from '../embeddings/validate-embeddings.js';
import { MAX_TOP_K } from './constants.js';
import { RetrievalError } from './retrieval.error.js';

export function validateTopK(topK: number, maxTopK: number = MAX_TOP_K): void {
  if (!Number.isInteger(topK) || topK < 1) {
    throw new RetrievalError(
      `Invalid topK: ${topK} (expected a positive integer)`,
      'TOP_K_INVALID',
    );
  }

  if (topK > maxTopK) {
    throw new RetrievalError(
      `topK too large: ${topK} (max ${maxTopK})`,
      'TOP_K_TOO_LARGE',
    );
  }
}

export function validateQueryEmbedding(
  queryEmbedding: number[],
  expectedDimensions: number = EMBEDDING_DIMENSIONS,
): void {
  try {
    validateEmbeddingVector(queryEmbedding, 'query', expectedDimensions);
  } catch (error) {
    if (error instanceof EmbeddingPipelineError) {
      throw new RetrievalError(error.message, error.code, error);
    }
    throw error;
  }
}
