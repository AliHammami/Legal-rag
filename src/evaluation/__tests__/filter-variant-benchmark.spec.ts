import { describe, expect, it } from 'vitest';

import {
  applyFilterVariant,
  selectFilterBenchmarkCohort,
} from '../multicorpus/filter-variant-benchmark.js';
import {
  buildQuestionQuotaAuditRecord,
  type QuestionQuotaAuditRecord,
} from '../multicorpus/rerank-filter-quota-audit.js';

function makeRecord(
  questionId: string,
  classification: 'A' | 'B' | 'C',
  rerankScores: Array<[string, string, number]>,
  goldArticles: Array<{ corpusId: string; articleNumber: string }> = [],
): QuestionQuotaAuditRecord {
  return buildQuestionQuotaAuditRecord({
    questionId,
    question: `Question ${questionId}`,
    routedCorpusIds: ['code-a', 'code-b'],
    goldArticles,
    retrieval: rerankScores.map(([corpusId, articleNumber], index) => ({
      chunkId: `${articleNumber}#0`,
      corpusId,
      articleNumber,
      retrievalDistance: 0.1 + index * 0.01,
      retrievalRank: index + 1,
    })),
    rerank: rerankScores.map(([corpusId, articleNumber, rerankScore], index) => ({
      chunkId: `${articleNumber}#0`,
      corpusId,
      articleNumber,
      rerankScore,
      rerankRank: index + 1,
    })),
  });
}

describe('filter-variant-benchmark', () => {
  it('selects a balanced cohort including q353 when present', () => {
    const records = [
      makeRecord('q353', 'C', [
        ['code-a', '1', 0.9],
        ['code-b', '2', 0.1],
      ]),
      ...Array.from({ length: 10 }, (_, index) =>
        makeRecord(`qC${index}`, 'C', [
          ['code-a', `a${index}`, 0.9],
          ['code-b', `b${index}`, 0.1],
        ]),
      ),
      ...Array.from({ length: 5 }, (_, index) =>
        makeRecord(`qB${index}`, 'B', [
          ['code-a', `ba${index}`, 0.9],
          ['code-a', `bb${index}`, 0.8],
        ]),
      ),
      ...Array.from({ length: 5 }, (_, index) =>
        makeRecord(`qA${index}`, 'A', [
          ['code-a', `aa${index}`, 0.9],
          ['code-b', `ab${index}`, 0.5],
        ]),
      ),
    ];

    const cohort = selectFilterBenchmarkCohort(records, 15);

    expect(cohort.questionIds).toContain('q353');
    expect(cohort.questionIds.length).toBe(15);
    expect(cohort.rationale.q353).toContain('mandatory');
  });

  it('applies the three filter variants differently', () => {
    const reranked = makeRecord(
      'q1',
      'C',
      [
        ['code-a', '1', 0.9],
        ['code-b', '2', 0.25],
      ],
    );

    const chunks = reranked.rerank.map((entry, index) => ({
      corpusId: entry.corpusId,
      chunkId: entry.chunkId,
      articleNumber: entry.articleNumber,
      content: entry.articleNumber,
      distance: 0,
      rerankScore: entry.rerankScore,
      metadata: {
        articleNumber: entry.articleNumber,
        pageStart: 0,
        pageEnd: 0,
        source: '',
        sourceType: 'pdf' as const,
        chunkIndex: 0,
        chunkCount: 1,
        unitStart: 0,
        unitEnd: 0,
        unitCount: 1,
      },
    }));

    const a = applyFilterVariant(chunks, ['code-a', 'code-b'], 'A_baseline_0.40');
    const b = applyFilterVariant(chunks, ['code-a', 'code-b'], 'B_threshold_0.25');
    const c = applyFilterVariant(chunks, ['code-a', 'code-b'], 'C_min1_corpus_0.40');

    expect(a).toHaveLength(1);
    expect(b).toHaveLength(2);
    expect(c).toHaveLength(2);
  });
});
