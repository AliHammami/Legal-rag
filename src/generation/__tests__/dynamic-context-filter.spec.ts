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
  corpusId = 'code-penal',
): RerankedChunk {
  const articleNumber = chunkId.split('#')[0] ?? chunkId;

  return {
    corpusId,
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

describe('dynamicContextFilter multicorpus min1/corpus', () => {
  const routedCorpora = ['code-civil', 'code-du-travail'] as const;

  it('keeps monocorpus threshold behavior without fallback', () => {
    const input = [
      makeChunk('L1237-3#0', 1.0, 'code-du-travail'),
      makeChunk('L1224-2#0', 0.5, 'code-du-travail'),
      makeChunk('10#0', 0.1, 'code-civil'),
    ];

    expect(
      dynamicContextFilter(input, {
        routedCorpusIds: ['code-du-travail'],
      }).map((chunk) => chunk.chunkId),
    ).toEqual(['L1237-3#0', 'L1224-2#0']);
  });

  it('does not add chunks when every routed corpus already survives threshold', () => {
    const input = [
      makeChunk('L1237-3#0', 1.0, 'code-du-travail'),
      makeChunk('10#0', 0.5, 'code-civil'),
      makeChunk('L1224-2#0', 0.1, 'code-du-travail'),
    ];

    expect(
      dynamicContextFilter(input, { routedCorpusIds: [...routedCorpora] }).map(
        (chunk) => chunk.chunkId,
      ),
    ).toEqual(['L1237-3#0', '10#0']);
  });

  it('reintroduces the best chunk for a routed corpus lost at threshold', () => {
    const input = [
      makeChunk('L1237-3#0', 1.0, 'code-du-travail'),
      makeChunk('L1224-2#0', 0.5, 'code-du-travail'),
      makeChunk('10#0', 0.15, 'code-civil'),
      makeChunk('1797#0', 0.05, 'code-civil'),
    ];

    expect(
      dynamicContextFilter(input, { routedCorpusIds: [...routedCorpora] }).map(
        (chunk) => chunk.chunkId,
      ),
    ).toEqual(['L1237-3#0', 'L1224-2#0', '10#0']);
  });

  it('adds only one fallback chunk for the missing corpus', () => {
    const input = [
      makeChunk('L1237-3#0', 1.0, 'code-du-travail'),
      makeChunk('L1224-2#0', 0.5, 'code-du-travail'),
      makeChunk('L1237-2#0', 0.45, 'code-du-travail'),
      makeChunk('10#0', 0.15, 'code-civil'),
      makeChunk('1797#0', 0.05, 'code-civil'),
    ];

    const filtered = dynamicContextFilter(input, {
      routedCorpusIds: [...routedCorpora],
    });

    expect(filtered.map((chunk) => chunk.chunkId)).toEqual([
      'L1237-3#0',
      'L1224-2#0',
      'L1237-2#0',
      '10#0',
    ]);
    expect(filtered.filter((chunk) => chunk.corpusId === 'code-civil')).toHaveLength(
      1,
    );
  });

  it('does not invent a chunk when a routed corpus has no Jina candidate', () => {
    const input = [
      makeChunk('L1237-3#0', 1.0, 'code-du-travail'),
      makeChunk('L1224-2#0', 0.5, 'code-du-travail'),
    ];

    expect(
      dynamicContextFilter(input, { routedCorpusIds: [...routedCorpora] }).map(
        (chunk) => chunk.chunkId,
      ),
    ).toEqual(['L1237-3#0', 'L1224-2#0']);
  });

  it('preserves global fallback behavior when routedCorpusIds is absent', () => {
    const input = [
      makeChunk('L1237-3#0', 1.0, 'code-du-travail'),
      makeChunk('L1224-2#0', 0.5, 'code-du-travail'),
      makeChunk('10#0', 0.15, 'code-civil'),
    ];

    expect(
      dynamicContextFilter(input).map((chunk) => chunk.chunkId),
    ).toEqual(['L1237-3#0', 'L1224-2#0']);
  });

  it('adds at most one fallback chunk per missing routed corpus for three corpora', () => {
    const input = [
      makeChunk('L1237-3#0', 1.0, 'code-du-travail'),
      makeChunk('10#0', 0.05, 'code-civil'),
      makeChunk('122-6#0', 0.04, 'code-penal'),
      makeChunk('122-5#0', 0.03, 'code-penal'),
    ];

    const filtered = dynamicContextFilter(input, {
      routedCorpusIds: ['code-civil', 'code-du-travail', 'code-penal'],
    });

    expect(filtered.map((chunk) => chunk.corpusId)).toEqual([
      'code-du-travail',
      'code-civil',
      'code-penal',
    ]);
    expect(filtered.filter((chunk) => chunk.corpusId === 'code-penal')).toHaveLength(
      1,
    );
  });
});

describe('computeRelativeScore', () => {
  it('returns 1 for the best score when bestScore is zero', () => {
    expect(computeRelativeScore(0, 0)).toBe(1);
  });
});
