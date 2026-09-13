import { describe, expect, it } from 'vitest';
import {
  mapBatchToEmbeddedChunks,
  normalizeEmbeddingVectors,
} from '../map-embeddings.js';
import { EMBEDDING_DIMENSIONS } from '../constants.js';
import type { PenalCodeChunk } from '../../chunking/types.js';

function vector(seed: number): number[] {
  return Array.from({ length: EMBEDDING_DIMENSIONS }, (_, i) => seed + i * 0.001);
}

const chunk: PenalCodeChunk = {
  chunkId: '121-3#0',
  articleNumber: '121-3',
  content: 'Texte juridique',
  charCount: 15,
  metadata: {
    articleNumber: '121-3',
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

describe('normalizeEmbeddingVectors', () => {
  it('valide les indices 0..n-1 et trie avant mapping positionnel', () => {
    const results = [
      { index: 1, embedding: vector(2) },
      { index: 0, embedding: vector(1) },
    ];
    const vectors = normalizeEmbeddingVectors(results, 2);
    expect(vectors[0]).toEqual(vector(1));
    expect(vectors[1]).toEqual(vector(2));
  });

  it('rejette un index dupliqué', () => {
    expect(() =>
      normalizeEmbeddingVectors(
        [
          { index: 0, embedding: vector(1) },
          { index: 0, embedding: vector(2) },
        ],
        2,
      ),
    ).toThrow(/Duplicate embedding index/);
  });

  it('rejette un index hors plage', () => {
    expect(() =>
      normalizeEmbeddingVectors(
        [
          { index: 0, embedding: vector(1) },
          { index: 2, embedding: vector(2) },
        ],
        2,
      ),
    ).toThrow(/Invalid embedding index/);
  });

  it('rejette un count mismatch', () => {
    expect(() =>
      normalizeEmbeddingVectors([{ index: 0, embedding: vector(1) }], 2),
    ).toThrow(/Expected 2 embeddings/);
  });
});

describe('mapBatchToEmbeddedChunks', () => {
  it('associe chunks[i] ↔ embeddings[i]', () => {
    const chunks = [chunk, { ...chunk, chunkId: '121-3#1', content: 'Autre' }];
    const embeddings = [vector(1), vector(2)];
    const records = mapBatchToEmbeddedChunks(chunks, embeddings);
    expect(records[0]!.chunkId).toBe('121-3#0');
    expect(records[0]!.embedding).toEqual(vector(1));
    expect(records[1]!.chunkId).toBe('121-3#1');
    expect(records[1]!.embedding).toEqual(vector(2));
  });
});
