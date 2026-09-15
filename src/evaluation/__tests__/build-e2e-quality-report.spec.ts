import { describe, expect, it } from 'vitest';

import { buildE2EQualityReport } from '../build-e2e-quality-report.js';
import { EvaluationError } from '../evaluation.error.js';
import type { E2EEvaluatedReport } from '../e2e-judge.types.js';

function makeEvaluatedResult(
  id: string,
  expectedAbstention: boolean,
  judge: {
    correctness: number;
    completeness: number;
    groundedness: number;
    abstentionCorrect: boolean;
    explanation: string;
  },
): Extract<E2EEvaluatedReport['results'][number], { status: 'success' }> {
  return {
    status: 'success',
    id,
    question: `Question ${id}`,
    expectedAbstention,
    goldArticles: expectedAbstention ? [] : ['122-5'],
    referenceAnswer: expectedAbstention ? null : 'Référence',
    generatedAnswer: 'Réponse générée',
    context: 'Contexte',
    retrievedChunks: [],
    rerankedChunks: [],
    filteredContextChunks: [{ rank: 1, chunkId: '122-5#0', articleNumber: '122-5' }],
    contextFiltering: {
      jinaResults: 1,
      contextResults: 1,
      relativeScoreThreshold: 0.4,
    },
    sources: [],
    timings: {
      embeddingMs: 100,
      vectorSearchMs: 50,
      jinaRerankingMs: 200,
      mappingMs: 1,
      retrievalTotalMs: 351,
      contextFilteringMs: 1,
      contextBuilderMs: 2,
      generationMs: 3000,
      answerPipelineTotalMs: 3354,
    },
    rerankStatus: 'success',
    judge,
  };
}

function makeEvaluatedReport(
  results: Extract<E2EEvaluatedReport['results'][number], { status: 'success' }>[],
): E2EEvaluatedReport {
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
    results,
  };
}

describe('buildE2EQualityReport', () => {
  it('separates normal and abstention questions', () => {
    const report = buildE2EQualityReport(
      makeEvaluatedReport([
        makeEvaluatedResult('q001', false, {
          correctness: 4,
          completeness: 4,
          groundedness: 4,
          abstentionCorrect: true,
          explanation: 'ok',
        }),
        makeEvaluatedResult('q002', false, {
          correctness: 2,
          completeness: 4,
          groundedness: 4,
          abstentionCorrect: true,
          explanation: 'partial',
        }),
        makeEvaluatedResult('q021', true, {
          correctness: 4,
          completeness: 4,
          groundedness: 4,
          abstentionCorrect: true,
          explanation: 'abstained',
        }),
        makeEvaluatedResult('q022', true, {
          correctness: 4,
          completeness: 4,
          groundedness: 4,
          abstentionCorrect: false,
          explanation: 'failed abstention',
        }),
      ]),
    );

    expect(report.normalQuestions.count).toBe(2);
    expect(report.abstentionQuestions.count).toBe(2);
    expect(report.normalQuestions.averageCorrectness).toBe(3);
    expect(report.normalQuestions.correctnessPassRate).toBe(50);
    expect(report.abstentionQuestions.abstentionCorrectCount).toBe(1);
    expect(report.abstentionQuestions.abstentionIncorrectCount).toBe(1);
    expect(report.abstentionQuestions.abstentionAccuracy).toBe(50);
    expect(report.abstentionQuestions.failedQuestionIds).toEqual(['q022']);
  });

  it('does not include abstention questions in normal averages', () => {
    const report = buildE2EQualityReport(
      makeEvaluatedReport([
        makeEvaluatedResult('q001', false, {
          correctness: 4,
          completeness: 4,
          groundedness: 4,
          abstentionCorrect: true,
          explanation: 'ok',
        }),
        makeEvaluatedResult('q021', true, {
          correctness: 0,
          completeness: 0,
          groundedness: 0,
          abstentionCorrect: true,
          explanation: 'abstained',
        }),
      ]),
    );

    expect(report.normalQuestions.averageCorrectness).toBe(4);
    expect(report.normalQuestions.correctnessDistribution).toEqual({
      '0': 0,
      '1': 0,
      '2': 0,
      '3': 0,
      '4': 1,
    });
  });

  it('builds score distributions', () => {
    const report = buildE2EQualityReport(
      makeEvaluatedReport([
        makeEvaluatedResult('q001', false, {
          correctness: 4,
          completeness: 3,
          groundedness: 2,
          abstentionCorrect: true,
          explanation: 'ok',
        }),
        makeEvaluatedResult('q002', false, {
          correctness: 4,
          completeness: 4,
          groundedness: 4,
          abstentionCorrect: true,
          explanation: 'ok',
        }),
        makeEvaluatedResult('q021', true, {
          correctness: 4,
          completeness: 4,
          groundedness: 4,
          abstentionCorrect: true,
          explanation: 'abstained',
        }),
      ]),
    );

    expect(report.normalQuestions.groundednessDistribution).toEqual({
      '0': 0,
      '1': 0,
      '2': 1,
      '3': 0,
      '4': 1,
    });
  });

  it('flags problematic questions for low scores and abstention failures', () => {
    const report = buildE2EQualityReport(
      makeEvaluatedReport([
        makeEvaluatedResult('q001', false, {
          correctness: 2,
          completeness: 4,
          groundedness: 4,
          abstentionCorrect: true,
          explanation: 'low correctness',
        }),
        makeEvaluatedResult('q002', false, {
          correctness: 4,
          completeness: 2,
          groundedness: 4,
          abstentionCorrect: true,
          explanation: 'low completeness',
        }),
        makeEvaluatedResult('q003', false, {
          correctness: 4,
          completeness: 4,
          groundedness: 2,
          abstentionCorrect: true,
          explanation: 'low groundedness',
        }),
        makeEvaluatedResult('q021', true, {
          correctness: 4,
          completeness: 4,
          groundedness: 4,
          abstentionCorrect: false,
          explanation: 'bad abstention',
        }),
        makeEvaluatedResult('q022', true, {
          correctness: 4,
          completeness: 4,
          groundedness: 4,
          abstentionCorrect: true,
          explanation: 'good abstention',
        }),
      ]),
    );

    expect(report.problematicQuestions.map((item) => item.questionId)).toEqual([
      'q001',
      'q002',
      'q003',
      'q021',
    ]);
    expect(report.problematicQuestions[0]?.correctness).toBe(2);
    expect(report.problematicQuestions[3]?.abstentionCorrect).toBe(false);
  });

  it('computes descriptive latency metrics separately', () => {
    const report = buildE2EQualityReport(
      makeEvaluatedReport([
        {
          ...makeEvaluatedResult('q001', false, {
            correctness: 4,
            completeness: 4,
            groundedness: 4,
            abstentionCorrect: true,
            explanation: 'ok',
          }),
          context: '12345',
          timings: {
            ...makeEvaluatedResult('q001', false, {
              correctness: 4,
              completeness: 4,
              groundedness: 4,
              abstentionCorrect: true,
              explanation: 'ok',
            }).timings,
            answerPipelineTotalMs: 1000,
          },
        },
        {
          ...makeEvaluatedResult('q021', true, {
            correctness: 4,
            completeness: 4,
            groundedness: 4,
            abstentionCorrect: true,
            explanation: 'abstained',
          }),
          context: '1234567890',
          filteredContextChunks: [],
          timings: {
            ...makeEvaluatedResult('q021', true, {
              correctness: 4,
              completeness: 4,
              groundedness: 4,
              abstentionCorrect: true,
              explanation: 'abstained',
            }).timings,
            answerPipelineTotalMs: 2000,
          },
        },
      ]),
    );

    expect(report.latency.all.averageTotalLatencyMs).toBe(1500);
    expect(report.latency.normalQuestions.averageContextCharacters).toBe(5);
    expect(report.latency.abstentionQuestions.averageContextCharacters).toBe(10);
    expect(report.latency.abstentionQuestions.averageFilteredContextChunks).toBe(0);
  });

  it('fails explicitly on an empty dataset', () => {
    expect(() =>
      buildE2EQualityReport(
        makeEvaluatedReport([]),
      ),
    ).toThrow(EvaluationError);
  });
});
