import { describe, expect, it } from 'vitest';
import { EMBEDDING_DIMENSIONS } from '../../embeddings/constants.js';
import { formatVectorLiteral } from '../format-vector.js';
import { PersistenceError } from '../persistence.error.js';

describe('formatVectorLiteral', () => {
  it('formats a vector as a pgvector literal', () => {
    expect(formatVectorLiteral([0.1, -0.2, 0.3], 3)).toBe('[0.1,-0.2,0.3]');
  });

  it('rejects invalid dimensions', () => {
    expect(() => formatVectorLiteral([0.1, 0.2])).toThrow(PersistenceError);
    expect(() => formatVectorLiteral([0.1, 0.2])).toThrow(
      `Invalid embedding dimension: 2 (expected ${EMBEDDING_DIMENSIONS})`,
    );
  });

  it('accepts the expected embedding dimension count', () => {
    const embedding = Array.from({ length: EMBEDDING_DIMENSIONS }, (_, i) => i * 0.001);
    expect(formatVectorLiteral(embedding)).toBe(`[${embedding.join(',')}]`);
  });
});
