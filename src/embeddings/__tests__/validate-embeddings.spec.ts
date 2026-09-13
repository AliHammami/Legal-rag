import { describe, expect, it } from 'vitest';
import { EMBEDDING_DIMENSIONS } from '../constants.js';
import {
  validateEmbeddingVector,
  validateInputChunks,
  validateOutputRecords,
} from '../validate-embeddings.js';
import type { PenalCodeChunk } from '../../chunking/types.js';
import type { PenalCodeEmbeddedChunk } from '../types.js';

function makeChunk(id: string, content = 'text'): PenalCodeChunk {
  return {
    chunkId: id,
    articleNumber: '111-1',
    content,
    charCount: content.length,
    metadata: {
      articleNumber: '111-1',
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
  };
}

describe('validateInputChunks', () => {
  it('rejette les chunkId dupliqués', () => {
    expect(() =>
      validateInputChunks([makeChunk('111-1#0'), makeChunk('111-1#0')]),
    ).toThrow(/Duplicate chunkId/);
  });

  it('rejette le contenu vide', () => {
    expect(() => validateInputChunks([makeChunk('111-1#0', '   ')])).toThrow(
      /Empty content/,
    );
  });
});

describe('validateEmbeddingVector', () => {
  it('rejette une dimension incorrecte', () => {
    expect(() => validateEmbeddingVector([1, 2, 3], '111-1#0')).toThrow(
      /Invalid embedding dimension/,
    );
  });
});

describe('validateOutputRecords', () => {
  it('valide count, dimensions et absence de perte', () => {
    const input = [makeChunk('111-1#0'), makeChunk('111-2#0')];
    const embedding = Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0.1);
    const records: PenalCodeEmbeddedChunk[] = input.map((chunk) => ({
      ...chunk,
      embedding,
    }));
    const stats = validateOutputRecords(input, records);
    expect(stats.missingChunks).toBe(0);
    expect(stats.duplicateChunkIds).toBe(0);
  });
});
