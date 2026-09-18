import { describe, expect, it } from 'vitest';

import {
  buildMulticorpusDatasetReport,
  formatMulticorpusDatasetReport,
} from '../report-multicorpus-dataset.js';
import { FIXTURE_MULTICORPUS_QUESTIONS } from './fixtures/multicorpus-dataset.fixture.js';

describe('reportMulticorpusDataset', () => {
  it('builds report sections for fixture dataset', () => {
    const report = buildMulticorpusDatasetReport(FIXTURE_MULTICORPUS_QUESTIONS);

    expect(report.totalQuestions).toBe(5);
    expect(report.byQuestionType['single-corpus']).toBe(2);
    expect(report.byQuestionType['multi-corpus']).toBe(1);
    expect(report.byQuestionType.ambiguous).toBe(1);
    expect(report.byQuestionType['out-of-scope']).toBe(1);
    expect(report.byCorpus.find((entry) => entry.corpusId === 'code-penal')?.questionCount).toBe(2);
    expect(formatMulticorpusDatasetReport(report)).toContain('Total questions: 5');
  });
});
