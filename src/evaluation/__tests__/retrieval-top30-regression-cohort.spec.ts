import { describe, expect, it } from 'vitest';

import { buildRetrievalTop30RegressionCohort } from '../multicorpus/retrieval-top30-regression-cohort.js';

describe('retrieval-top30-regression-cohort', () => {
  it('includes mandatory topK30 gains and stays within max size', () => {
    const cohort = buildRetrievalTop30RegressionCohort({
      datasetQuestions: [
        { id: 'q334', questionType: 'multi-corpus' } as never,
        { id: 'q367', questionType: 'multi-corpus' } as never,
        { id: 'q378', questionType: 'single-corpus' } as never,
        { id: 'q401', questionType: 'ambiguous' } as never,
        { id: 'q402', questionType: 'ambiguous' } as never,
        { id: 'q450', questionType: 'out-of-scope' } as never,
        { id: 'q451', questionType: 'out-of-scope' } as never,
      ],
      contextLossRecords: [
        {
          questionId: 'q352',
          questionType: 'multi-corpus',
          primaryLossStage: 'retrieval',
        },
        {
          questionId: 'q362',
          questionType: 'multi-corpus',
          primaryLossStage: 'filter',
        },
        {
          questionId: 'q371',
          questionType: 'multi-corpus',
          primaryLossStage: 'reranking',
        },
      ],
      e2eResults: [
        {
          questionId: 'q001',
          questionType: 'single-corpus',
          routing: { judge: { correctness: 4, completeness: 4, groundedness: 4 } },
        } as never,
        {
          questionId: 'q002',
          questionType: 'single-corpus',
          routing: { judge: { correctness: 3, completeness: 3, groundedness: 4 } },
        } as never,
      ],
      routingResults: [
        { questionId: 'q011', predictedCorpusIds: [] } as never,
      ],
      maxQuestions: 30,
    });

    expect(cohort.questionIds).toContain('q334');
    expect(cohort.questionIds).toContain('q367');
    expect(cohort.questionIds).toContain('q378');
    expect(cohort.questionIds.length).toBeLessThanOrEqual(30);
    expect(new Set(cohort.questionIds).size).toBe(cohort.questionIds.length);
  });
});
