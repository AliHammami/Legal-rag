import { describe, expect, it } from 'vitest';

import { loadMulticorpusCorpusArticleRegistry } from '../load-corpus-article-index.js';
import { validateMulticorpusEvaluationDataset } from '../validate-multicorpus-dataset.js';
import { FIXTURE_MULTICORPUS_QUESTIONS } from './fixtures/multicorpus-dataset.fixture.js';

describe('validateMulticorpusEvaluationDataset', () => {
  it('validates fixture structure and article existence for sample questions', async () => {
    const registry = await loadMulticorpusCorpusArticleRegistry();
    const summary = validateMulticorpusEvaluationDataset(
      FIXTURE_MULTICORPUS_QUESTIONS,
      registry,
    );

    expect(summary.invalidGoldCorpusIds).toEqual([]);
    expect(summary.missingCorpusArticles).toEqual([]);
    expect(summary.invalidQuestionTypeConsistency).toEqual([]);
    expect(summary.duplicateIds).toEqual([]);
  });

  it('detects inconsistent questionType and goldCorpusIds', async () => {
    const registry = await loadMulticorpusCorpusArticleRegistry();
    const summary = validateMulticorpusEvaluationDataset(
      [
        {
          ...FIXTURE_MULTICORPUS_QUESTIONS[0]!,
          questionType: 'multi-corpus',
          goldCorpusIds: ['code-penal'],
        },
      ],
      registry,
    );

    expect(summary.invalidQuestionTypeConsistency.length).toBeGreaterThan(0);
    expect(summary.isValid).toBe(false);
  });
});
