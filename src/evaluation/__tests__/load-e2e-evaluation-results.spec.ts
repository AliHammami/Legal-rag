import { describe, expect, it } from 'vitest';

import { EvaluationError } from '../evaluation.error.js';
import {
  loadE2EEvaluationResults,
  parseE2EEvaluationReport,
} from '../load-e2e-evaluation-results.js';

describe('parseE2EEvaluationReport', () => {
  it('parses a valid results report', () => {
    const report = parseE2EEvaluationReport({
      metadata: {
        dataset: 'data/evaluation/code-penal.e2e.questions.json',
        questionCount: 1,
        generationModel: 'gpt-test',
        embeddingModel: 'text-embedding-3-large',
        rerankerModel: 'jina-reranker-v3.5',
        contextThreshold: 0.4,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      results: [
        {
          status: 'success',
          id: 'q001',
          question: 'Question',
          expectedAbstention: false,
          goldArticles: ['122-5'],
          referenceAnswer: 'Référence',
          generatedAnswer: 'Réponse',
          context: 'Contexte',
        },
      ],
    });

    expect(report.results).toHaveLength(1);
    expect(report.metadata.questionCount).toBe(1);
  });

  it('rejects mismatched question counts', async () => {
    await expect(
      loadE2EEvaluationResults(
        'data/evaluation/results/code-penal.e2e.results.json',
        { expectedQuestionCount: 99 },
      ),
    ).rejects.toThrow(EvaluationError);
  });
});
