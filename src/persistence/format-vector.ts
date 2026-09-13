import { EMBEDDING_DIMENSIONS } from '../embeddings/constants.js';
import { PersistenceError } from './persistence.error.js';

export function formatVectorLiteral(
  embedding: number[],
  expectedDimensions: number = EMBEDDING_DIMENSIONS,
): string {
  if (embedding.length !== expectedDimensions) {
    throw new PersistenceError(
      `Invalid embedding dimension: ${embedding.length} (expected ${expectedDimensions})`,
      'EMBEDDING_DIMENSION_INVALID',
    );
  }

  return `[${embedding.join(',')}]`;
}
