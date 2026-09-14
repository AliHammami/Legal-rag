import { describe, expect, it } from 'vitest';
import type { SimilarChunk } from '../../retrieval/types.js';
import { RerankingError } from '../reranking.error.js';
import { validateRerankingInput } from '../validate-reranking-input.js';

function makeChunk(chunkId: string): SimilarChunk {
  return {
    chunkId,
    articleNumber: chunkId.split('#')[0] ?? chunkId,
    content: `Content for ${chunkId}`,
    metadata: {
      articleNumber: chunkId.split('#')[0] ?? chunkId,
      pageStart: 1,
      pageEnd: 1,
      source: 'data/code-penal.pdf',
      sourceType: 'pdf',
      chunkIndex: 0,
      chunkCount: 1,
      unitStart: 0,
      unitEnd: 0,
      unitCount: 1,
    },
    distance: 0.4,
  };
}

describe('validateRerankingInput', () => {
  const chunks = [makeChunk('122-5#0'), makeChunk('122-6#0')];

  it('accepts valid input', () => {
    expect(validateRerankingInput('Question valide ?', chunks, 2)).toBe(
      'Question valide ?',
    );
  });

  it('trims the question', () => {
    expect(validateRerankingInput('  Question valide ?  ', chunks, 2)).toBe(
      'Question valide ?',
    );
  });

  it('rejects empty question', () => {
    expect(() => validateRerankingInput('', chunks, 1)).toThrow(RerankingError);
  });

  it('rejects whitespace-only question', () => {
    expect(() => validateRerankingInput('   ', chunks, 1)).toThrow(RerankingError);
  });

  it('rejects empty chunks', () => {
    expect(() => validateRerankingInput('Question ?', [], 1)).toThrow(
      RerankingError,
    );
  });

  it('rejects invalid topK values', () => {
    expect(() => validateRerankingInput('Question ?', chunks, 0)).toThrow(
      RerankingError,
    );
    expect(() => validateRerankingInput('Question ?', chunks, -1)).toThrow(
      RerankingError,
    );
  });

  it('rejects topK greater than chunk count', () => {
    expect(() => validateRerankingInput('Question ?', chunks, 3)).toThrow(
      RerankingError,
    );
  });
});
