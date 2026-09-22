import { describe, expect, it } from 'vitest';

import { buildHybridMiniRegressionCohort } from '../multicorpus/retrieval-hybrid-mini-regression-cohort.js';
import {
  classifyHybridMiniRegressionDecision,
  compareQuestionVariants,
  type MiniRegressionVariantRecord,
} from '../multicorpus/retrieval-hybrid-mini-regression-report.js';

function stubVariant(
  variant: 'vector_top30' | 'union_hybrid',
  judge: { correctness: number; completeness: number },
): MiniRegressionVariantRecord {
  return {
    variant,
    retrievalCandidates: [],
    retrievalGoldRecall: 0,
    retrievalFullCoverage: false,
    retrievalCorpusCoverage: null,
    jinaTop5: [],
    finalContextChunkIds: [],
    finalContextGoldArticles: [],
    finalContextFullCoverage: false,
    answer: variant === 'vector_top30' ? 'a' : 'b',
    judge: {
      correctness: judge.correctness,
      completeness: judge.completeness,
      groundedness: 4,
      sourceRelevance: 4,
      sourceCoverage: 4,
      abstentionCorrect: true,
    },
    error: null,
  };
}

describe('buildHybridMiniRegressionCohort', () => {
  it('returns at most 30 deterministic slots', () => {
    const meta = new Map([
      [
        'q001',
        {
          questionId: 'q001',
          questionType: 'single-corpus',
          goldArticles: [
            { corpusId: 'code-penal', articleNumber: '1' },
            { corpusId: 'code-penal', articleNumber: '2' },
          ],
        },
      ],
    ]);
    const cohort = buildHybridMiniRegressionCohort({
      metaById: meta,
      smokeRecords: [
        {
          questionId: 'q001',
          variants: {
            vector: {
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
                chunkCount: 2,
              },
              jinaTop5: [],
              filterRows: [
                {
                  chunkId: '1#0',
                  corpusId: 'code-penal',
                  articleNumber: '1',
                  rerankScore: 1,
                  kept: true,
                },
              ],
              finalContextChunkIds: ['1#0'],
            },
            union: {
              variant: 'union',
              candidateCount: 90,
              retrieval: {
                goldHits: 1,
                goldTotal: 1,
                goldRecall: 1,
                fullCoverage: true,
                corpusCoverage: null,
                corpusTotal: null,
                chunkCount: 90,
              },
              afterJina: {
                goldHits: 1,
                goldTotal: 1,
                goldRecall: 1,
                fullCoverage: true,
                corpusCoverage: null,
                corpusTotal: null,
                chunkCount: 5,
              },
              afterFilter: {
                goldHits: 1,
                goldTotal: 1,
                goldRecall: 1,
                fullCoverage: true,
                corpusCoverage: null,
                corpusTotal: null,
                chunkCount: 2,
              },
              jinaTop5: [],
              filterRows: [
                {
                  chunkId: '1#0',
                  corpusId: 'code-penal',
                  articleNumber: '1',
                  rerankScore: 1,
                  kept: true,
                },
                {
                  chunkId: '2#0',
                  corpusId: 'code-penal',
                  articleNumber: '2',
                  rerankScore: 0.5,
                  kept: true,
                },
              ],
              finalContextChunkIds: ['1#0', '2#0'],
            },
          },
        },
      ],
      maxSize: 30,
    });
    expect(cohort.questionIds).toEqual(['q001']);
    expect(cohort.slots[0]?.category).toBe('union_adds_gold');
  });
});

describe('classifyHybridMiniRegressionDecision', () => {
  it('passes when union improves without major regressions', () => {
    const decision = classifyHybridMiniRegressionDecision({
      cohortSize: 20,
      summary: {
        vector: {
          correctness: 2,
          completeness: 2,
          groundedness: 4,
          sourceRelevance: 3,
          sourceCoverage: 4,
          abstentionCorrectRate: 1,
        },
        union: {
          correctness: 2.5,
          completeness: 2.7,
          groundedness: 3.9,
          sourceRelevance: 3.2,
          sourceCoverage: 3.9,
          abstentionCorrectRate: 1,
        },
        delta: {
          correctness: 0.5,
          completeness: 0.7,
          groundedness: -0.1,
          sourceRelevance: 0.2,
          sourceCoverage: -0.1,
        },
        retrieval: {
          vectorGoldRecall: 0.5,
          unionGoldRecall: 0.6,
          vectorFinalGoldRecall: 0.4,
          unionFinalGoldRecall: 0.5,
          vectorFullCoverageRate: 0.3,
          unionFullCoverageRate: 0.35,
        },
        comparisonCounts: {
          unionImproves: 6,
          unionDegrades: 1,
          equivalent: 13,
          identicalAnswers: 10,
        },
      },
    });
    expect(decision.category).toBe('HYBRID_NON_REGRESSION_PASS');
  });
});

describe('compareQuestionVariants', () => {
  it('flags union improvement from judge deltas', () => {
    const comparison = compareQuestionVariants({
      goldArticles: [],
      vector: stubVariant('vector_top30', { correctness: 2, completeness: 2 }),
      union: stubVariant('union_hybrid', { correctness: 3, completeness: 3 }),
    });
    expect(comparison.outcome).toBe('union_improves');
  });
});
