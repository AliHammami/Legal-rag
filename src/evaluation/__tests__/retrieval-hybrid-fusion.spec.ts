import { describe, expect, it } from 'vitest';

import {
  DEFAULT_HYBRID_RRF_K,
  dedupeUnionCandidates,
  reciprocalRankFusion,
} from '../multicorpus/retrieval-hybrid-fusion.js';
import { computeGoldContribution } from '../multicorpus/retrieval-hybrid-metrics.js';

describe('retrieval-hybrid-fusion', () => {
  it('dedupes union by chunkId preserving vector-first order', () => {
    const union = dedupeUnionCandidates(
      [
        {
          rank: 1,
          chunkId: 'a#0',
          corpusId: 'c',
          articleNumber: 'a',
        },
        {
          rank: 2,
          chunkId: 'b#0',
          corpusId: 'c',
          articleNumber: 'b',
        },
      ],
      [
        {
          rank: 1,
          chunkId: 'a#0',
          corpusId: 'c',
          articleNumber: 'a',
        },
        {
          rank: 2,
          chunkId: 'c#0',
          corpusId: 'c',
          articleNumber: 'c',
        },
      ],
    );
    expect(union.map((chunk) => chunk.chunkId)).toEqual(['a#0', 'b#0', 'c#0']);
  });

  it('computes RRF with documented k', () => {
    const fused = reciprocalRankFusion(
      [
        {
          name: 'vector',
          ranked: [
            {
              rank: 1,
              chunkId: 'a#0',
              corpusId: 'c',
              articleNumber: 'a',
            },
          ],
        },
        {
          name: 'bm25',
          ranked: [
            {
              rank: 1,
              chunkId: 'b#0',
              corpusId: 'c',
              articleNumber: 'b',
            },
            {
              rank: 2,
              chunkId: 'a#0',
              corpusId: 'c',
              articleNumber: 'a',
            },
          ],
        },
      ],
      { k: DEFAULT_HYBRID_RRF_K },
    );
    expect(fused[0]?.chunkId).toBe('a#0');
    expect(fused[0]?.rrfScore).toBeCloseTo(
      1 / (DEFAULT_HYBRID_RRF_K + 1) + 1 / (DEFAULT_HYBRID_RRF_K + 2),
    );
  });

  it('splits gold contribution vector/bm25/both', () => {
    const contribution = computeGoldContribution(
      [
        { corpusId: 'code-penal', articleNumber: '1' },
        { corpusId: 'code-penal', articleNumber: '2' },
      ],
      [
        {
          rank: 1,
          chunkId: '1#0',
          corpusId: 'code-penal',
          articleNumber: '1',
        },
      ],
      [
        {
          rank: 1,
          chunkId: '2#0',
          corpusId: 'code-penal',
          articleNumber: '2',
        },
      ],
    );
    expect(contribution.vectorOnly).toHaveLength(1);
    expect(contribution.bm25Only).toHaveLength(1);
    expect(contribution.both).toHaveLength(0);
  });
});
