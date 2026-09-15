import { describe, expect, it } from 'vitest';

import { EvaluationError } from '../evaluation.error.js';
import {
  EXPECTED_E2E_QUESTION_COUNT,
  verifyE2EEvaluatedSnapshot,
  verifyE2EResultsSnapshot,
} from '../verify-e2e-snapshots.js';
import type { E2EEvaluationReport } from '../e2e-evaluation.types.js';
import type { E2EEvaluatedReport } from '../e2e-judge.types.js';

function makeSuccessResult(
  id: string,
  expectedAbstention: boolean,
): Extract<E2EEvaluationReport['results'][number], { status: 'success' }> {
  return {
    status: 'success',
    id,
    question: `Question ${id}`,
    expectedAbstention,
    goldArticles: expectedAbstention ? [] : ['122-5'],
    referenceAnswer: expectedAbstention ? null : 'Référence',
    generatedAnswer: 'Réponse générée',
    context: `[Source 1 — Article 122-5 — chunk 0]\nContenu.`,
    retrievedChunks: [],
    rerankedChunks: [],
    filteredContextChunks: [],
    contextFiltering: {
      jinaResults: 1,
      contextResults: 1,
      relativeScoreThreshold: 0.4,
    },
    sources: [
      {
        sourceId: 1,
        chunkId: '122-5#0',
        articleNumber: '122-5',
        chunkIndex: 0,
      },
    ],
    timings: {
      embeddingMs: 0,
      vectorSearchMs: 0,
      jinaRerankingMs: 0,
      mappingMs: 0,
      retrievalTotalMs: 0,
      contextFilteringMs: 0,
      contextBuilderMs: 0,
      generationMs: 0,
      answerPipelineTotalMs: 1000,
    },
    rerankStatus: 'success',
  };
}

function makeResultsReport(
  resultCount: number,
): E2EEvaluationReport {
  const results = Array.from({ length: resultCount }, (_, index) => {
    const id = `q${String(index + 1).padStart(3, '0')}`;
    return makeSuccessResult(id, index >= 20);
  });

  return {
    metadata: {
      dataset: 'data/evaluation/code-penal.e2e.questions.json',
      questionCount: resultCount,
      generationModel: 'gpt-test',
      embeddingModel: 'text-embedding-3-large',
      rerankerModel: 'jina-reranker-v3.5',
      contextThreshold: 0.4,
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    results,
  };
}

describe('verifyE2EResultsSnapshot', () => {
  it('accepts a valid 25-question snapshot shape', () => {
    const report = makeResultsReport(EXPECTED_E2E_QUESTION_COUNT);
    const summary = verifyE2EResultsSnapshot(report);

    expect(summary.questionCount).toBe(25);
    expect(summary.normalQuestionCount).toBe(20);
    expect(summary.abstentionQuestionCount).toBe(5);
    expect(summary.errorCount).toBe(0);
  });

  it('rejects unexpected question counts', () => {
    expect(() => verifyE2EResultsSnapshot(makeResultsReport(24))).toThrow(
      EvaluationError,
    );
  });
});

describe('verifyE2EEvaluatedSnapshot', () => {
  it('requires judge fields on every question', () => {
    const report = makeResultsReport(1) as E2EEvaluatedReport;
    report.evaluation = {
      type: 'llm-as-a-judge',
      judgeModel: 'judge-test',
      createdAt: '2026-01-02T00:00:00.000Z',
      criteria: ['correctness', 'completeness', 'groundedness', 'abstention'],
    };
    report.results[0] = {
      ...report.results[0]!,
      judge: {
        correctness: 4,
        completeness: 4,
        groundedness: 4,
        abstentionCorrect: true,
        explanation: 'ok',
      },
    };

    expect(() => verifyE2EEvaluatedSnapshot(report)).toThrow(EvaluationError);
  });
});
