import { describe, expect, it } from 'vitest';
import { mapSearchResult, mapSearchResults } from '../map-search-result.js';
import type { SimilarChunkRow } from '../types.js';

function makeRow(
  chunkId: string,
  distance: number | string,
): SimilarChunkRow {
  return {
    chunk_id: chunkId,
    article_number: chunkId.split('#')[0] ?? chunkId,
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
    distance,
  };
}

describe('mapSearchResult', () => {
  it('maps snake_case SQL row to SimilarChunk', () => {
    const result = mapSearchResult(makeRow('111-1#0', 0.042));

    expect(result).toEqual({
      chunkId: '111-1#0',
      articleNumber: '111-1',
      content: 'Content for 111-1#0',
      metadata: expect.objectContaining({ articleNumber: '111-1' }),
      distance: 0.042,
    });
  });

  it('parses string distance from PostgreSQL', () => {
    const result = mapSearchResult(makeRow('111-2#0', '0.042'));
    expect(result.distance).toBe(0.042);
  });
});

describe('mapSearchResults', () => {
  it('preserves PostgreSQL row order without sorting', () => {
    const rows = [
      makeRow('a#0', 0.05),
      makeRow('b#0', 0.1),
      makeRow('c#0', 0.3),
    ];

    const results = mapSearchResults(rows);

    expect(results.map((r) => r.distance)).toEqual([0.05, 0.1, 0.3]);
    expect(results.map((r) => r.chunkId)).toEqual(['a#0', 'b#0', 'c#0']);
  });
});
