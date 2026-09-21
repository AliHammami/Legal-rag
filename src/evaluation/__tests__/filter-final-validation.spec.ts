import { describe, expect, it } from 'vitest';

import {
  applyFinalValidationFilter,
  selectFinalValidationCohort,
} from '../multicorpus/filter-final-validation.js';
import {
  buildQuestionQuotaAuditRecord,
  type QuestionQuotaAuditRecord,
} from '../multicorpus/rerank-filter-quota-audit.js';

function makeRecord(
  questionId: string,
  classification: 'A' | 'B' | 'C',
): QuestionQuotaAuditRecord {
  return buildQuestionQuotaAuditRecord({
    questionId,
    question: `Question ${questionId}`,
    routedCorpusIds: ['code-a', 'code-b'],
    goldArticles: [
      { corpusId: 'code-a', articleNumber: '1' },
      { corpusId: 'code-b', articleNumber: '2' },
    ],
    retrieval: [
      {
        chunkId: '1#0',
        corpusId: 'code-a',
        articleNumber: '1',
        retrievalDistance: 0.1,
        retrievalRank: 1,
      },
      {
        chunkId: '2#0',
        corpusId: 'code-b',
        articleNumber: '2',
        retrievalDistance: 0.2,
        retrievalRank: 2,
      },
    ],
    rerank: [
      {
        chunkId: '1#0',
        corpusId: 'code-a',
        articleNumber: '1',
        rerankScore: 0.9,
        rerankRank: 1,
      },
      {
        chunkId: '2#0',
        corpusId: 'code-b',
        articleNumber: '2',
        rerankScore: 0.1,
        rerankRank: 2,
      },
    ],
  });
}

describe('filter-final-validation', () => {
  it('selects at least 30 questions including mandatory ids', () => {
    const records = Array.from({ length: 41 }, (_, index) => {
      const id = index < 15 ? `q${350 + index}` : `q${400 + index - 15}`;
      const mappedId =
        index === 3 ? 'q353' : index === 14 ? 'q352' : id.replace(/^q(\d+)$/, (_, n) => `q${n}`);
      return makeRecord(mappedId, index % 3 === 0 ? 'A' : index % 3 === 1 ? 'B' : 'C');
    });

    for (const mandatoryId of [
      'q353',
      'q365',
      'q372',
      'q377',
      'q380',
      'q396',
      'q410',
      'q361',
      'q374',
      'q375',
      'q378',
      'q362',
      'q363',
      'q371',
      'q352',
    ]) {
      if (!records.some((record) => record.questionId === mandatoryId)) {
        records.push(makeRecord(mandatoryId, 'C'));
      }
    }

    const cohort = selectFinalValidationCohort(records, { minSize: 30, maxSize: 41 });
    expect(cohort.questionIds.length).toBeGreaterThanOrEqual(30);
    expect(cohort.questionIds).toContain('q353');
  });

  it('applies conditional min1 filter for multicorpus', () => {
    const chunks = makeRecord('q1', 'C').rerank.map((entry) => ({
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

    const baseline = applyFinalValidationFilter(chunks, ['code-a', 'code-b'], 'A_baseline_0.40');
    const conditional = applyFinalValidationFilter(
      chunks,
      ['code-a', 'code-b'],
      'B_conditional_min1_0.40',
    );

    expect(baseline).toHaveLength(1);
    expect(conditional).toHaveLength(2);
  });
});
