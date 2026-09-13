import { describe, expect, it } from 'vitest';
import { EMBEDDING_DIMENSIONS } from '../../embeddings/constants.js';
import { RetrievalError } from '../retrieval.error.js';
import {
  validateQueryEmbedding,
  validateTopK,
} from '../validate-search-input.js';

function vector(length: number): number[] {
  return Array.from({ length }, (_, i) => i * 0.001);
}

describe('validateTopK', () => {
  it('accepts valid topK values', () => {
    expect(() => validateTopK(20)).not.toThrow();
    expect(() => validateTopK(100)).not.toThrow();
  });

  it('rejects invalid topK values', () => {
    expect(() => validateTopK(0)).toThrow(RetrievalError);
    expect(() => validateTopK(-1)).toThrow(RetrievalError);
    expect(() => validateTopK(1.5)).toThrow(RetrievalError);
    expect(() => validateTopK(Number.NaN)).toThrow(RetrievalError);
  });

  it('rejects topK above MAX_TOP_K', () => {
    expect(() => validateTopK(101)).toThrow(RetrievalError);
    expect(() => validateTopK(101)).toThrow(/too large/);
  });
});

describe('validateQueryEmbedding', () => {
  it('accepts a valid embedding vector', () => {
    expect(() =>
      validateQueryEmbedding(vector(EMBEDDING_DIMENSIONS)),
    ).not.toThrow();
  });

  it('rejects wrong dimension', () => {
    expect(() => validateQueryEmbedding(vector(3071))).toThrow(RetrievalError);
    expect(() => validateQueryEmbedding(vector(3073))).toThrow(RetrievalError);
  });

  it('rejects non-finite values', () => {
    const invalid = vector(EMBEDDING_DIMENSIONS);
    invalid[0] = Number.NaN;
    expect(() => validateQueryEmbedding(invalid)).toThrow(RetrievalError);

    invalid[0] = Number.POSITIVE_INFINITY;
    expect(() => validateQueryEmbedding(invalid)).toThrow(RetrievalError);
  });
});
