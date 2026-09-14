import { describe, expect, it } from 'vitest';
import type { SimilarChunk } from '../../retrieval/types.js';
import {
  applyRerankOrdering,
  parseRerankModelResponse,
} from '../parse-rerank-response.js';
import { RerankingError } from '../reranking.error.js';

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

describe('parseRerankModelResponse', () => {
  it('parses a valid structured response', () => {
    const parsed = parseRerankModelResponse({
      rankedChunks: [{ chunkId: '122-6#0' }, { chunkId: '122-5#0' }],
    });

    expect(parsed.rankedChunks).toEqual([
      { chunkId: '122-6#0' },
      { chunkId: '122-5#0' },
    ]);
  });

  it('rejects invalid response shape', () => {
    expect(() => parseRerankModelResponse({})).toThrow(RerankingError);
  });

  it('rejects empty rankedChunks', () => {
    expect(() =>
      parseRerankModelResponse({ rankedChunks: [] }),
    ).toThrow(RerankingError);
  });
});

describe('applyRerankOrdering', () => {
  const chunks = [makeChunk('122-5#0', 0.42), makeChunk('122-6#0', 0.18)];

  it('reorders chunks and applies topK while preserving original fields', () => {
    const result = applyRerankOrdering(
      chunks,
      {
        rankedChunks: [{ chunkId: '122-6#0' }, { chunkId: '122-5#0' }],
      },
      1,
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.chunkId).toBe('122-6#0');
    expect(result[0]?.distance).toBe(0.18);
    expect(result[0]?.content).toBe('Content for 122-6#0');
  });

  it('rejects unknown chunkId', () => {
    expect(() =>
      applyRerankOrdering(
        chunks,
        {
          rankedChunks: [{ chunkId: '999-9#0' }, { chunkId: '122-5#0' }],
        },
        1,
      ),
    ).toThrow(RerankingError);
  });

  it('rejects duplicate chunkId', () => {
    expect(() =>
      applyRerankOrdering(
        chunks,
        {
          rankedChunks: [{ chunkId: '122-5#0' }, { chunkId: '122-5#0' }],
        },
        1,
      ),
    ).toThrow(RerankingError);
  });

  it('rejects incomplete ranking', () => {
    expect(() =>
      applyRerankOrdering(
        chunks,
        {
          rankedChunks: [{ chunkId: '122-5#0' }],
        },
        1,
      ),
    ).toThrow(RerankingError);
  });

  it('rejects missing candidate when length matches but a candidate is absent', () => {
    expect(() =>
      applyRerankOrdering(
        [makeChunk('221-4#0', 0.1), makeChunk('221-4#1', 0.2)],
        {
          rankedChunks: [{ chunkId: '221-4#0' }, { chunkId: '221-4#0' }],
        },
        1,
      ),
    ).toThrow(RerankingError);
  });
});
