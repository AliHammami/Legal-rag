import { describe, expect, it } from 'vitest';

import { buildE2ESourceReport } from '../build-e2e-source-report.js';
import { EvaluationError } from '../evaluation.error.js';
import type { E2ESourcesEvaluatedReport } from '../e2e-source-judge.types.js';

function makeSourcesEvaluatedReport(
  results: Array<{
    id: string;
    sourceRelevance: number;
    sourceCoverage: number;
    expectedAbstention?: boolean;
  }>,
): E2ESourcesEvaluatedReport {
  return {
    metadata: {
      dataset: 'data/evaluation/code-penal.e2e.questions.json',
      questionCount: results.length,
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
    sourceEvaluation: {
      type: 'llm-as-a-judge-sources',
      judgeModel: 'judge-test',
      createdAt: '2026-01-03T00:00:00.000Z',
    },
    results: results.map((result) => ({
      status: 'success' as const,
      id: result.id,
      question: `Question ${result.id}`,
      expectedAbstention: result.expectedAbstention ?? false,
      goldArticles: [],
      referenceAnswer: 'Référence',
      generatedAnswer: 'Réponse générée',
      context: `[Source 1 — Code pénal — Article 122-5 — chunk 0]\nContenu.`,
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
        answerPipelineTotalMs: 0,
      },
      rerankStatus: 'success',
      judge: {
        correctness: 4,
        completeness: 4,
        groundedness: 4,
        abstentionCorrect: true,
        explanation: 'ok',
      },
      sourceJudge: {
        sourceRelevance: result.sourceRelevance,
        sourceCoverage: result.sourceCoverage,
        explanation: 'source judge',
      },
    })),
  };
}

describe('buildE2ESourceReport', () => {
  it('computes averages, pass rates, distributions and problematic IDs', () => {
    const report = buildE2ESourceReport(
      makeSourcesEvaluatedReport([
        { id: 'q001', sourceRelevance: 4, sourceCoverage: 4 },
        { id: 'q002', sourceRelevance: 2, sourceCoverage: 3 },
        { id: 'q003', sourceRelevance: 3, sourceCoverage: 1 },
        {
          id: 'q021',
          sourceRelevance: 3,
          sourceCoverage: 4,
          expectedAbstention: true,
        },
      ]),
      'data/evaluation/results/code-penal.e2e.evaluated.json',
    );

    expect(report.summary.averageSourceRelevance).toBe(3);
    expect(report.summary.averageSourceCoverage).toBe(3);
    expect(report.summary.sourceRelevancePassRate).toBe(75);
    expect(report.summary.sourceCoveragePassRate).toBe(75);
    expect(report.summary.sourceRelevanceDistribution).toEqual({
      '0': 0,
      '1': 0,
      '2': 1,
      '3': 2,
      '4': 1,
    });
    expect(report.summary.lowSourceRelevanceQuestionIds).toEqual(['q002']);
    expect(report.summary.lowSourceCoverageQuestionIds).toEqual(['q003']);
  });

  it('fails explicitly on an empty dataset', () => {
    expect(() =>
      buildE2ESourceReport(makeSourcesEvaluatedReport([]), 'input.json'),
    ).toThrow(EvaluationError);
  });
});
