import { describe, expect, it } from 'vitest';

import { EvaluationError } from '../evaluation.error.js';
import {
  loadE2EEvaluatedReport,
  parseE2EEvaluatedReport,
} from '../load-e2e-evaluated-report.js';

describe('parseE2EEvaluatedReport', () => {
  it('rejects snapshots without evaluation metadata', () => {
    expect(() =>
      parseE2EEvaluatedReport({
        metadata: {
          dataset: 'data/evaluation/code-penal.e2e.questions.json',
          questionCount: 1,
          generationModel: 'gpt-test',
          embeddingModel: 'text-embedding-3-large',
          rerankerModel: 'jina-reranker-v3.5',
          contextThreshold: 0.4,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
        results: [],
      }),
    ).toThrow(EvaluationError);
  });

  it('rejects success results without judge scores', () => {
    expect(() =>
      parseE2EEvaluatedReport({
        metadata: {
          dataset: 'data/evaluation/code-penal.e2e.questions.json',
          questionCount: 1,
          generationModel: 'gpt-test',
          embeddingModel: 'text-embedding-3-large',
          rerankerModel: 'jina-reranker-v3.5',
          contextThreshold: 0.4,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
        evaluation: {
          type: 'llm-as-a-judge',
          judgeModel: 'judge-test',
          createdAt: '2026-01-02T00:00:00.000Z',
          criteria: ['correctness', 'completeness', 'groundedness', 'abstention'],
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
      }),
    ).toThrow(/judge block is required/);
  });
});

describe('loadE2EEvaluatedReport', () => {
  it('loads the real evaluated snapshot', async () => {
    const report = await loadE2EEvaluatedReport(
      'data/evaluation/results/code-penal.e2e.evaluated.json',
    );

    expect(report.results).toHaveLength(25);
    expect(report.evaluation.judgeModel).toBeTruthy();
  });
});
