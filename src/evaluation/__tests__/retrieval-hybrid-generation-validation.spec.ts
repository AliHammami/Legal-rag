import { describe, expect, it } from 'vitest';

import {
  classifyGoldAddedImpact,
  classifyHybridGenerationDecision,
  selectHybridGenerationValidationCohort,
} from '../multicorpus/retrieval-hybrid-generation-validation.js';
import type { HybridRerankFilterVariantResult } from '../multicorpus/retrieval-hybrid-rerank-filter-smoke.js';

function stubVariant(finalIds: string[], keptArticles: string[]): HybridRerankFilterVariantResult {
  const filterRows = keptArticles.map((articleNumber, index) => ({
    chunkId: `${articleNumber}#0`,
    corpusId: 'code-penal',
    articleNumber,
    rerankScore: 1 - index * 0.1,
    kept: true,
  }));
  return {
    variant: 'vector',
    candidateCount: 50,
    retrieval: {
      goldHits: 0,
      goldTotal: 1,
      goldRecall: 0,
      fullCoverage: false,
      corpusCoverage: null,
      corpusTotal: null,
      chunkCount: 50,
    },
    afterJina: {
      goldHits: 0,
      goldTotal: 1,
      goldRecall: 0,
      fullCoverage: false,
      corpusCoverage: null,
      corpusTotal: null,
      chunkCount: 5,
    },
    afterFilter: {
      goldHits: 0,
      goldTotal: 1,
      goldRecall: 0,
      fullCoverage: false,
      corpusCoverage: null,
      corpusTotal: null,
      chunkCount: filterRows.length,
    },
    jinaTop5: filterRows.map((row, index) => ({
      rank: index + 1,
      chunkId: row.chunkId,
      corpusId: row.corpusId,
      articleNumber: row.articleNumber,
      score: row.rerankScore,
    })),
    filterRows,
    finalContextChunkIds: finalIds,
  };
}

describe('selectHybridGenerationValidationCohort', () => {
  it('prioritizes union gold additions then bm25-only then context-only', () => {
    const meta = new Map([
      [
        'qA',
        {
          questionId: 'qA',
          goldArticles: [{ corpusId: 'code-penal', articleNumber: '1' }],
          goldArticlesBm25Only: [],
        },
      ],
      [
        'qB',
        {
          questionId: 'qB',
          goldArticles: [{ corpusId: 'code-penal', articleNumber: '2' }],
          goldArticlesBm25Only: [{ corpusId: 'code-penal', articleNumber: '2' }],
        },
      ],
      [
        'qC',
        {
          questionId: 'qC',
          goldArticles: [{ corpusId: 'code-penal', articleNumber: '3' }],
          goldArticlesBm25Only: [],
        },
      ],
      [
        'qSame',
        {
          questionId: 'qSame',
          goldArticles: [{ corpusId: 'code-penal', articleNumber: '9' }],
          goldArticlesBm25Only: [],
        },
      ],
    ]);

    const records = [
      {
        questionId: 'qSame',
        variants: {
          vector: stubVariant(['9#0'], ['9']),
          union: stubVariant(['9#0'], ['9']),
        },
      },
      {
        questionId: 'qC',
        variants: {
          vector: stubVariant(['3#0'], ['3']),
          union: stubVariant(['3#0', '4#0'], ['3', '4']),
        },
      },
      {
        questionId: 'qB',
        variants: {
          vector: stubVariant(['2#0'], ['2']),
          union: stubVariant(['2#0', 'y#0'], ['2', 'y']),
        },
      },
      {
        questionId: 'qA',
        variants: {
          vector: stubVariant(['x#0'], ['x']),
          union: stubVariant(['1#0'], ['1']),
        },
      },
    ];

    const { entries, skippedSameContext } = selectHybridGenerationValidationCohort(
      records,
      meta,
      { maxSize: 3 },
    );

    expect(skippedSameContext).toBe(1);
    expect(entries.map((entry) => entry.questionId)).toEqual(['qA', 'qB', 'qC']);
    expect(entries[0]?.tier).toBe('union_adds_gold');
    expect(entries[1]?.tier).toBe('bm25_only_signal');
    expect(entries[2]?.tier).toBe('context_diff_only');
  });
});

describe('classifyGoldAddedImpact', () => {
  it('detects improvement when union judge scores rise', () => {
    expect(
      classifyGoldAddedImpact({
        goldAddedByUnion: [{ corpusId: 'code-penal', articleNumber: '1' }],
        vector: {
          correctness: 3,
          completeness: 3,
          groundedness: 4,
          sourceRelevance: 3,
          sourceCoverage: 3,
        },
        union: {
          correctness: 4,
          completeness: 4,
          groundedness: 4,
          sourceRelevance: 3,
          sourceCoverage: 4,
        },
      }),
    ).toBe('improves_answer');
  });
});

describe('classifyHybridGenerationDecision', () => {
  it('returns insufficient evidence for tiny cohorts', () => {
    const decision = classifyHybridGenerationDecision({
      cohortSize: 3,
      vectorAvg: {
        correctness: 3,
        completeness: 3,
        groundedness: 3,
        sourceRelevance: 3,
        sourceCoverage: 3,
      },
      unionAvg: {
        correctness: 4,
        completeness: 4,
        groundedness: 4,
        sourceRelevance: 4,
        sourceCoverage: 4,
      },
      perQuestion: [],
    });
    expect(decision.category).toBe('INSUFFICIENT_EVIDENCE');
  });
});
