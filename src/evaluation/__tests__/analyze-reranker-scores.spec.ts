import { describe, expect, it } from 'vitest';

import {
  analyzeQuestionRerankScores,
  buildRerankScoreEntries,
  computeConsecutiveGaps,
  computeRelativeToBest,
  countGoldArticlesInTop5,
  filterByRelativeThreshold,
  findLargestGap,
  findLastGoldRank,
  summarizeRelativeThresholds,
  wouldLoseGoldFromTop5,
} from '../analyze-reranker-scores.js';
import type { EvaluationQuestion } from '../types.js';
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

const question: EvaluationQuestion = {
  id: 'q001',
  question: 'Quelles sont les conditions de la légitime défense ?',
  goldArticles: ['122-5', '122-6'],
};

const reranked = [
  makeChunk('122-6#0', 0.2965),
  makeChunk('122-5#0', 0.1197),
  makeChunk('462-9#0', 0.0591),
  makeChunk('462-11#0', 0.0402),
  makeChunk('122-7#0', 0.0311),
];

describe('computeConsecutiveGaps', () => {
  it('computes absolute gaps and ratios between consecutive scores', () => {
    const gaps = computeConsecutiveGaps([0.2965, 0.1197, 0.0591]);

    expect(gaps[0]).toEqual({
      fromRank: 1,
      toRank: 2,
      absoluteGap: expect.closeTo(0.1768, 4),
      ratio: expect.closeTo(0.1197 / 0.2965, 5),
    });
    expect(gaps[1]).toEqual({
      fromRank: 2,
      toRank: 3,
      absoluteGap: expect.closeTo(0.0606, 4),
      ratio: expect.closeTo(0.0591 / 0.1197, 5),
    });
  });
});

describe('computeRelativeToBest', () => {
  it('expresses each score relative to the best score', () => {
    expect(computeRelativeToBest([0.2965, 0.1197, 0.0591])).toEqual([
      1,
      expect.closeTo(0.1197 / 0.2965, 5),
      expect.closeTo(0.0591 / 0.2965, 5),
    ]);
  });
});

describe('findLargestGap', () => {
  it('returns the largest consecutive gap', () => {
    const gaps = computeConsecutiveGaps([0.2965, 0.1197, 0.0591]);
    const largestGap = findLargestGap(gaps);

    expect(largestGap).toEqual({
      fromRank: 1,
      toRank: 2,
      absoluteGap: expect.closeTo(0.1768, 4),
      ratio: expect.closeTo(0.1197 / 0.2965, 5),
    });
  });
});

describe('buildRerankScoreEntries', () => {
  it('marks gold articles as relevant', () => {
    const entries = buildRerankScoreEntries(reranked, question.goldArticles);

    expect(entries.map((entry) => entry.relevant)).toEqual([
      true,
      true,
      false,
      false,
      false,
    ]);
  });
});

describe('countGoldArticlesInTop5', () => {
  it('deduplicates article numbers before counting gold hits', () => {
    expect(
      countGoldArticlesInTop5(
        ['122-6', '122-5', '122-6', '462-9'],
        question.goldArticles,
      ),
    ).toBe(2);
  });
});

describe('findLastGoldRank', () => {
  it('returns the highest rank containing a gold article', () => {
    const entries = buildRerankScoreEntries(reranked, question.goldArticles);

    expect(findLastGoldRank(entries)).toBe(2);
  });
});

describe('filterByRelativeThreshold', () => {
  it('keeps only results above the relative threshold', () => {
    const entries = buildRerankScoreEntries(reranked, question.goldArticles);
    const kept = filterByRelativeThreshold(entries, 0.4);

    expect(kept.map((entry) => entry.articleNumber)).toEqual(['122-6', '122-5']);
  });
});

describe('wouldLoseGoldFromTop5', () => {
  it('detects when a gold article would be removed by the threshold', () => {
    const entries = buildRerankScoreEntries(reranked, question.goldArticles);

    expect(wouldLoseGoldFromTop5(entries, 0.5, question.goldArticles)).toBe(true);
    expect(wouldLoseGoldFromTop5(entries, 0.3, question.goldArticles)).toBe(false);
  });
});

describe('summarizeRelativeThresholds', () => {
  it('computes average kept documents and gold loss per threshold', () => {
    const analysis = analyzeQuestionRerankScores(question, reranked);
    const summaries = summarizeRelativeThresholds([analysis]);

    expect(summaries).toEqual([
      {
        threshold: 0.2,
        averageDocumentsKept: 2,
        questionsLosingGold: 0,
      },
      {
        threshold: 0.3,
        averageDocumentsKept: 2,
        questionsLosingGold: 0,
      },
      {
        threshold: 0.4,
        averageDocumentsKept: 2,
        questionsLosingGold: 0,
      },
      {
        threshold: 0.5,
        averageDocumentsKept: 1,
        questionsLosingGold: 1,
      },
      {
        threshold: 0.6,
        averageDocumentsKept: 1,
        questionsLosingGold: 1,
      },
      {
        threshold: 0.7,
        averageDocumentsKept: 1,
        questionsLosingGold: 1,
      },
    ]);
  });
});

describe('analyzeQuestionRerankScores', () => {
  it('builds a complete per-question analysis', () => {
    const analysis = analyzeQuestionRerankScores(question, reranked);

    expect(analysis.goldArticlesInTop5).toBe(2);
    expect(analysis.lastGoldRank).toBe(2);
    expect(analysis.gaps).toHaveLength(4);
    expect(analysis.relativeToBest[0]).toBe(1);
    expect(analysis.largestGap?.fromRank).toBe(1);
  });
});
