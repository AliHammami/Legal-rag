import { describe, expect, it } from 'vitest';

import { EMBEDDING_DIMENSIONS } from '../../embeddings/constants.js';
import { validateEmbeddingVector } from '../../embeddings/validate-embeddings.js';

describe('persistence validation helpers', () => {
  it('rejects embeddings with invalid dimensions', () => {
    expect(() =>
      validateEmbeddingVector(
        Array.from({ length: 100 }, () => 0),
        '122-5#0',
        EMBEDDING_DIMENSIONS,
      ),
    ).toThrow(/Invalid embedding dimension/);
  });

  it('accepts embeddings with 3072 dimensions', () => {
    expect(() =>
      validateEmbeddingVector(
        Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0.1),
        '122-5#0',
        EMBEDDING_DIMENSIONS,
      ),
    ).not.toThrow();
  });
});
