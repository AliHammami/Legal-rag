import { describe, expect, it } from 'vitest';

import type { RerankedChunk } from '../../reranking/types.js';
import { DEFAULT_CONTEXT_TOP_K } from '../constants.js';
import {
  resolveContextTopK,
  selectContextChunks,
  validateContextTopK,
} from '../select-context-chunks.js';

function makeChunk(chunkId: string): RerankedChunk {
  const articleNumber = chunkId.split('#')[0] ?? chunkId;

  return {
    chunkId,
    articleNumber,
    content: `Content for ${chunkId}`,
    distance: 0.2,
    rerankScore: 0.9,
    metadata: {
      articleNumber,
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

const reranked = [
  makeChunk('122-6#0'),
  makeChunk('122-5#0'),
  makeChunk('462-9#0'),
  makeChunk('462-11#0'),
  makeChunk('122-7#0'),
];

describe('validateContextTopK', () => {
  it('accepts positive integers', () => {
    expect(validateContextTopK(5)).toBe(5);
  });

  it('rejects zero, negative, and non-integer values', () => {
    expect(() => validateContextTopK(0)).toThrow(
      /contextTopK must be a positive integer/,
    );
    expect(() => validateContextTopK(-1)).toThrow(
      /contextTopK must be a positive integer/,
    );
    expect(() => validateContextTopK(2.5)).toThrow(
      /contextTopK must be a positive integer/,
    );
    expect(() => validateContextTopK(Number.NaN)).toThrow(
      /contextTopK must be a positive integer/,
    );
  });
});

describe('resolveContextTopK', () => {
  it('defaults to 5 when the option is omitted', () => {
    expect(resolveContextTopK()).toBe(DEFAULT_CONTEXT_TOP_K);
    expect(resolveContextTopK(undefined)).toBe(5);
  });
});

describe('selectContextChunks', () => {
  it('keeps the first two reranked chunks in order', () => {
    const selected = selectContextChunks(reranked, 2);

    expect(selected.map((chunk) => chunk.articleNumber)).toEqual([
      '122-6',
      '122-5',
    ]);
  });

  it('keeps the first three reranked chunks in order', () => {
    const selected = selectContextChunks(reranked, 3);

    expect(selected.map((chunk) => chunk.articleNumber)).toEqual([
      '122-6',
      '122-5',
      '462-9',
    ]);
  });

  it('keeps all five reranked chunks in order', () => {
    const selected = selectContextChunks(reranked, 5);

    expect(selected.map((chunk) => chunk.articleNumber)).toEqual([
      '122-6',
      '122-5',
      '462-9',
      '462-11',
      '122-7',
    ]);
  });
});
