import { describe, expect, it } from 'vitest';

import {
  analyzeGoldDepth,
  buildGlobalRetrievalAtK,
  buildQuotaRetrievalAtK,
  classifyDepthDecision,
  classifyGoldDepthBucket,
  firstRankForGold,
  fullQuestionCoverageAtK,
  goldRecallAtK,
  rankRetrievalChunks,
  sliceRankedChunksAtK,
  summarizeDepthBuckets,
  summarizeMarginalGoldBands,
  type RankedRetrievalChunk,
} from '../multicorpus/retrieval-depth-benchmark.js';

function chunk(
  corpusId: string,
  articleNumber: string,
  rank: number,
  chunkIndex = 0,
): RankedRetrievalChunk {
  return {
    corpusId,
    articleNumber,
    chunkId: `${articleNumber}#${chunkIndex}`,
    rank,
  };
}

describe('retrieval-depth-benchmark', () => {
  it('matches gold on corpusId + articleNumber with multiple chunks', () => {
    const chunks = [
      chunk('code-penal', '222-1', 1, 0),
      chunk('code-penal', '222-1', 2, 1),
      chunk('code-penal', '222-3', 3),
    ];
    expect(
      firstRankForGold(
        { corpusId: 'code-penal', articleNumber: '222-1' },
        chunks,
      ),
    ).toBe(1);
  });

  it('computes recall and full question coverage', () => {
    const gold = [
      { corpusId: 'code-penal', articleNumber: '222-1' },
      { corpusId: 'code-penal', articleNumber: '222-3' },
    ];
    const chunks = [
      chunk('code-penal', '222-1', 1),
      chunk('code-penal', '222-4', 2),
    ];
    const recall = goldRecallAtK(gold, chunks, 20);
    expect(recall.hits).toBe(1);
    expect(recall.total).toBe(2);
    expect(recall.recall).toBe(0.5);
    expect(fullQuestionCoverageAtK(gold, chunks, 20)).toBe(false);
  });

  it('classifies depth buckets P20-30 through P50+', () => {
    expect(
      classifyGoldDepthBucket({
        ranksByK: { 20: 5 },
        observedMaxK: 50,
      }),
    ).toBe('present_at_20');

    expect(
      classifyGoldDepthBucket({
        ranksByK: { 20: null, 30: 25, 40: null, 50: null },
        observedMaxK: 50,
      }),
    ).toBe('P20_30');

    expect(
      classifyGoldDepthBucket({
        ranksByK: { 20: null, 30: null, 40: 38, 50: null },
        observedMaxK: 50,
      }),
    ).toBe('P30_40');

    expect(
      classifyGoldDepthBucket({
        ranksByK: { 20: null, 30: null, 40: null, 50: 45 },
        observedMaxK: 50,
      }),
    ).toBe('P40_50');

    expect(
      classifyGoldDepthBucket({
        ranksByK: { 20: null, 30: null, 40: null, 50: null },
        observedMaxK: 50,
      }),
    ).toBe('P50_plus');
  });

  it('marks absent beyond 20 when observed max K is 20', () => {
    const depth = analyzeGoldDepth(
      [{ corpusId: 'code-penal', articleNumber: '222-1' }],
      [chunk('code-penal', '222-3', 1)],
      20,
    );
    expect(depth[0]?.bucket).toBe('not_observed_beyond_20');
    expect(summarizeDepthBuckets(depth).notObservedBeyond20).toBe(1);
  });

  it('applies multicorpus quota merge at K=30 (15+15)', () => {
    const perCorpus = new Map<string, RankedRetrievalChunk[]>([
      [
        'code-civil',
        [
          chunk('code-civil', '9-1', 1),
          chunk('code-civil', '9-2', 2),
          chunk('code-civil', '9-3', 3),
        ],
      ],
      [
        'code-du-commerce',
        [
          chunk('code-du-commerce', 'L123-1', 1),
          chunk('code-du-commerce', 'L123-2', 2),
        ],
      ],
    ]);

    const merged = buildQuotaRetrievalAtK(
      perCorpus,
      ['code-civil', 'code-du-commerce'],
      30,
    );
    expect(merged.length).toBeLessThanOrEqual(30);
    expect(merged.some((entry) => entry.corpusId === 'code-civil')).toBe(true);
    expect(merged.some((entry) => entry.corpusId === 'code-du-commerce')).toBe(
      true,
    );
  });

  it('slices global retrieval at K', () => {
    const global = buildGlobalRetrievalAtK(
      [chunk('code-penal', '1', 1), chunk('code-penal', '2', 2), chunk('code-penal', '3', 3)],
      2,
    );
    expect(global).toHaveLength(2);
    expect(sliceRankedChunksAtK(global, 1)).toHaveLength(1);
  });

  it('summarizes marginal gold bands for absent @20', () => {
    const details = [
      {
        questionId: 'q1',
        gold: { corpusId: 'c', articleNumber: '1' },
        strategy: 'quota' as const,
        rank20: null,
        rank30: 25,
        rank40: 25,
        rank50: 25,
        distanceAtFirstHit: 0.5,
        absentAt20: true,
        depthBand: '21-30' as const,
      },
      {
        questionId: 'q2',
        gold: { corpusId: 'c', articleNumber: '2' },
        strategy: 'quota' as const,
        rank20: null,
        rank30: null,
        rank40: null,
        rank50: null,
        distanceAtFirstHit: null,
        absentAt20: true,
        depthBand: 'absent_at_50' as const,
      },
    ];
    const bands = summarizeMarginalGoldBands(details, true);
    expect(bands.find((band) => band.band === '21-30')?.newGoldArticles).toBe(1);
  });

  it('classifies depth decision categories', () => {
    const ceiling = classifyDepthDecision({
      absentAt20Details: [
        {
          questionId: 'q',
          gold: { corpusId: 'c', articleNumber: '1' },
          strategy: 'quota',
          rank20: null,
          rank30: null,
          rank40: null,
          rank50: null,
          distanceAtFirstHit: null,
          absentAt20: true,
          depthBand: 'absent_at_50',
        },
      ],
      recallAt20: 0.5,
      recallAt50: 0.52,
    });
    expect(ceiling.category).toBe('SEMANTIC_CEILING');
  });

  it('ranks persisted retrieval chunks by retrievalRank', () => {
    const ranked = rankRetrievalChunks([
      {
        chunkId: 'b#0',
        corpusId: 'code-penal',
        articleNumber: 'b',
        retrievalRank: 2,
      },
      {
        chunkId: 'a#0',
        corpusId: 'code-penal',
        articleNumber: 'a',
        retrievalRank: 1,
      },
    ]);
    expect(ranked[0]?.articleNumber).toBe('a');
  });
});
