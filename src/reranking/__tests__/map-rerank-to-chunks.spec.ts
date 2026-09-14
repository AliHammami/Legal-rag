import { describe, expect, it } from 'vitest';
import type { SimilarChunk } from '../../retrieval/types.js';
import { mapRerankResultsToChunks } from '../map-rerank-to-chunks.js';

function makeChunk(chunkId: string, distance: number): SimilarChunk {
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
    distance,
  };
}

describe('mapRerankResultsToChunks', () => {
  const chunks = [
    makeChunk('122-5#0', 0.42),
    makeChunk('122-6#0', 0.18),
    makeChunk('122-7#0', 0.55),
  ];

  it('preserves SimilarChunk fields and attaches rerankScore', () => {
    const results = mapRerankResultsToChunks(chunks, [
      { chunkId: '122-6#0', score: 0.98 },
      { chunkId: '122-5#0', score: 0.94 },
    ]);

    expect(results).toHaveLength(2);
    expect(results[0]?.chunkId).toBe('122-6#0');
    expect(results[0]?.distance).toBe(0.18);
    expect(results[0]?.rerankScore).toBe(0.98);
    expect(results[0]?.content).toBe('Content for 122-6#0');
  });
});
