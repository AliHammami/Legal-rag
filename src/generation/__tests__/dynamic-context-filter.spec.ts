import { describe, expect, it } from 'vitest';

import { DEFAULT_RELATIVE_SCORE_THRESHOLD } from '../constants.js';
import {
  computeRelativeScore,
  dynamicContextFilter,
} from '../dynamic-context-filter.js';
import type { RerankedChunk } from '../../reranking/types.js';

function makeChunk(
  chunkId: string,
  rerankScore: number,
): RerankedChunk {
  const articleNumber = chunkId.split('#')[0] ?? chunkId;

  return {
    chunkId,
    articleNumber,
    content: `Content for ${chunkId}`,
    distance: 0.2,
    rerankScore,
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

describe('dynamicContextFilter', () => {
  it('keeps results at or above the 40% relative threshold', () => {
    const input = [
      makeChunk('a#0', 1.0),
      makeChunk('b#0', 0.5),
      makeChunk('c#0', 0.2),
      makeChunk('d#0', 0.1),
    ];

    expect(
      dynamicContextFilter(input).map((chunk) => chunk.articleNumber),
    ).toEqual(['a', 'b']);
  });

  it('keeps a result exactly at 40% of the best score', () => {
    const input = [makeChunk('a#0', 1.0), makeChunk('b#0', 0.4)];

    expect(
      dynamicContextFilter(input).map((chunk) => chunk.articleNumber),
    ).toEqual(['a', 'b']);
  });

  it('filters q001 reranked results to 122-6 and 122-5', () => {
    const input = [
      makeChunk('122-6#0', 0.2965),
      makeChunk('122-5#0', 0.1197),
      makeChunk('462-9#0', 0.0591),
      makeChunk('462-11#0', 0.0269),
      makeChunk('122-7#0', 0.0261),
    ];

    expect(
      dynamicContextFilter(input).map((chunk) => chunk.articleNumber),
    ).toEqual(['122-6', '122-5']);
  });

  it('returns a single result unchanged', () => {
    const input = [makeChunk('122-6#0', 0.2965)];

    expect(dynamicContextFilter(input)).toEqual(input);
  });

  it('returns an empty array for empty input', () => {
    expect(dynamicContextFilter([])).toEqual([]);
  });

  it('never returns more than 5 chunks', () => {
    const input = Array.from({ length: 8 }, (_, index) =>
      makeChunk(`${index}#0`, 1 - index * 0.05),
    );

    expect(dynamicContextFilter(input)).toHaveLength(5);
  });

  it('preserves reranker order', () => {
    const input = [
      makeChunk('122-6#0', 0.2965),
      makeChunk('122-5#0', 0.1197),
      makeChunk('462-9#0', 0.0591),
    ];

    const filtered = dynamicContextFilter(input);

    expect(filtered.map((chunk) => chunk.chunkId)).toEqual([
      '122-6#0',
      '122-5#0',
    ]);
  });

  it('does not mutate the input array', () => {
    const input = [
      makeChunk('122-6#0', 0.2965),
      makeChunk('122-5#0', 0.1197),
      makeChunk('462-9#0', 0.0591),
    ];
    const snapshot = [...input];

    dynamicContextFilter(input);

    expect(input).toEqual(snapshot);
  });

  it('keeps only the best result when the best score is zero', () => {
    const input = [
      makeChunk('122-6#0', 0),
      makeChunk('122-5#0', -0.1),
      makeChunk('462-9#0', -0.2),
    ];

    expect(
      dynamicContextFilter(input).map((chunk) => chunk.articleNumber),
    ).toEqual(['122-6']);
  });

  it('uses the default threshold constant', () => {
    expect(DEFAULT_RELATIVE_SCORE_THRESHOLD).toBe(0.4);
  });
});

describe('computeRelativeScore', () => {
  it('returns 1 for the best score when bestScore is zero', () => {
    expect(computeRelativeScore(0, 0)).toBe(1);
  });
});
