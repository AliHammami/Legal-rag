import { describe, expect, it } from 'vitest';
import { mapJinaResultsToRerankResults } from '../map-jina-response.js';
import { RerankingError } from '../reranking.error.js';

const documents = [
  { chunkId: 'chunk-A', content: 'A' },
  { chunkId: 'chunk-B', content: 'B' },
  { chunkId: 'chunk-C', content: 'C' },
];

describe('mapJinaResultsToRerankResults', () => {
  it('maps Jina indices to original chunkIds in order', () => {
    const results = mapJinaResultsToRerankResults(documents, {
      results: [
        { index: 2, relevance_score: 0.91 },
        { index: 0, relevance_score: 0.87 },
        { index: 1, relevance_score: 0.75 },
      ],
    });

    expect(results).toEqual([
      { chunkId: 'chunk-C', score: 0.91 },
      { chunkId: 'chunk-A', score: 0.87 },
      { chunkId: 'chunk-B', score: 0.75 },
    ]);
  });

  it('rejects invalid response shape', () => {
    expect(() => mapJinaResultsToRerankResults(documents, {})).toThrow(
      RerankingError,
    );
  });

  it('rejects out-of-range index', () => {
    expect(() =>
      mapJinaResultsToRerankResults(documents, {
        results: [{ index: 99, relevance_score: 0.5 }],
      }),
    ).toThrow(RerankingError);
  });
});
