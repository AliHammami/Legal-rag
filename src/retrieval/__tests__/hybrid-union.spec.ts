import { describe, expect, it } from 'vitest';

import { dedupeUnionSimilarChunks } from '../hybrid-union.js';
import type { SimilarChunk } from '../types.js';

function chunk(chunkId: string, corpusId = 'code-penal'): SimilarChunk {
  return {
    corpusId,
    chunkId,
    articleNumber: chunkId.split('#')[0] ?? chunkId,
    content: 'x',
    metadata: {
      articleNumber: chunkId.split('#')[0] ?? chunkId,
      pageStart: 1,
      pageEnd: 1,
      source: 's',
      sourceType: 'pdf',
      chunkIndex: 0,
      chunkCount: 1,
      unitStart: 0,
      unitEnd: 0,
      unitCount: 1,
    },
    distance: 0.1,
  };
}

describe('dedupeUnionSimilarChunks', () => {
  it('keeps vector order and drops bm25 duplicates by chunkId', () => {
    const merged = dedupeUnionSimilarChunks(
      [chunk('a#0'), chunk('b#0')],
      [chunk('b#0'), chunk('c#0')],
    );
    expect(merged.map((row) => row.chunkId)).toEqual(['a#0', 'b#0', 'c#0']);
  });
});
