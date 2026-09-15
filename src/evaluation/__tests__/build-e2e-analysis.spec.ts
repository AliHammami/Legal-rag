import { describe, expect, it } from 'vitest';

import { buildE2EAnalysis } from '../build-e2e-analysis.js';
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
  filteredContextChunks: Array<{
    chunkId: string;
    articleNumber: string;
    score?: number;
  }> = [{ chunkId: '122-5#0', articleNumber: '122-5', score: 0.9 }],
): Extract<E2EEvaluatedReport['results'][number], { status: 'success' }> {
  return {
    status: 'success',
    id,
    question: `Question ${id}`,
    expectedAbstention,
    goldArticles: expectedAbstention ? [] : ['122-5'],
    referenceAnswer: expectedAbstention ? null : 'Référence',
    generatedAnswer: 'Réponse générée',
    context: 'Contexte complet non exporté',
    retrievedChunks: [{ rank: 1, chunkId: '122-5#0', articleNumber: '122-5' }],
    rerankedChunks: [{ rank: 1, chunkId: '122-5#0', articleNumber: '122-5' }],
    filteredContextChunks: filteredContextChunks.map((chunk, index) => ({
      rank: index + 1,
      chunkId: chunk.chunkId,
      articleNumber: chunk.articleNumber,
      score: chunk.score,
    })),
    contextFiltering: {
      jinaResults: 1,
      contextResults: filteredContextChunks.length,
      relativeScoreThreshold: 0.4,
    },
    sources: [],
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

describe('buildE2EAnalysis', () => {
  it('builds a compact analysis file with summary and questions', () => {
    const analysis = buildE2EAnalysis(
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
          abstentionCorrect: false,
          explanation: 'bad abstention',
        }),
      ]),
    );

    expect(analysis.summary).toEqual({
      totalQuestions: 3,
      normalQuestions: 2,
      abstentionQuestions: 1,
      averageCorrectness: 3,
      averageCompleteness: 4,
      averageGroundedness: 4,
      problematicQuestionIds: ['q002', 'q021'],
    });

    expect(analysis.questions).toHaveLength(3);
    expect(analysis.questions[0]).toEqual({
      id: 'q001',
      question: 'Question q001',
      expectedAbstention: false,
      goldArticles: ['122-5'],
      filteredContextChunks: [
        {
          chunkId: '122-5#0',
          articleNumber: '122-5',
          rerankScore: 0.9,
        },
      ],
      generatedAnswer: 'Réponse générée',
      judge: {
        correctness: 4,
        completeness: 4,
        groundedness: 4,
        abstentionCorrect: true,
        explanation: 'ok',
      },
    });
  });

  it('does not include vector retrieval, context, or timings', () => {
    const analysis = buildE2EAnalysis(
      makeEvaluatedReport([
        makeEvaluatedResult('q001', false, {
          correctness: 4,
          completeness: 4,
          groundedness: 4,
          abstentionCorrect: true,
          explanation: 'ok',
        }),
      ]),
    );

    const serialized = JSON.stringify(analysis);

    expect(serialized).not.toContain('retrievedChunks');
    expect(serialized).not.toContain('timings');
    expect(serialized).not.toContain('Contexte complet non exporté');
  });

  it('maps filtered chunk score to rerankScore', () => {
    const analysis = buildE2EAnalysis(
      makeEvaluatedReport([
        makeEvaluatedResult(
          'q001',
          false,
          {
            correctness: 4,
            completeness: 4,
            groundedness: 4,
            abstentionCorrect: true,
            explanation: 'ok',
          },
          [{ chunkId: '122-6#0', articleNumber: '122-6' }],
        ),
      ]),
    );

    expect(analysis.questions[0]?.filteredContextChunks[0]).toEqual({
      chunkId: '122-6#0',
      articleNumber: '122-6',
    });
  });

  it('fails explicitly on an empty dataset', () => {
    expect(() => buildE2EAnalysis(makeEvaluatedReport([]))).toThrow(
      EvaluationError,
    );
  });
});
