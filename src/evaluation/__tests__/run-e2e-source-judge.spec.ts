import { describe, expect, it, vi } from 'vitest';

import type { E2EEvaluatedReport } from '../e2e-judge.types.js';
import { runE2ESourceJudge } from '../run-e2e-source-judge.js';

function makeEvaluatedResult(
  id: string,
  expectedAbstention: boolean,
  context: string,
  sources: Array<{
    sourceId: number;
    chunkId: string;
    articleNumber: string;
    chunkIndex: number;
  }>,
): Extract<E2EEvaluatedReport['results'][number], { status: 'success' }> {
  return {
    status: 'success',
    id,
    question: `Question ${id}`,
    expectedAbstention,
    goldArticles: expectedAbstention ? [] : ['122-5'],
    referenceAnswer: expectedAbstention ? null : 'Référence',
    generatedAnswer: 'Réponse générée',
    context,
    retrievedChunks: [],
    rerankedChunks: [],
    filteredContextChunks: [],
    contextFiltering: {
      jinaResults: sources.length,
      contextResults: sources.length,
      relativeScoreThreshold: 0.4,
    },
    sources,
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

describe('runE2ESourceJudge', () => {
  it('preserves existing fields and adds sourceJudge sequentially', async () => {
    const judgeSources = vi.fn(async (input) => ({
      sourceRelevance: input.expectedAbstention ? 3 : 4,
      sourceCoverage: input.expectedAbstention ? 4 : 2,
      explanation: `Sources for ${input.questionId}`,
    }));

    const context = `[Source 1 — Article 122-5 — chunk 0]
Contenu source unique.`;

    const report = await runE2ESourceJudge(
      makeEvaluatedReport([
        makeEvaluatedResult('q001', false, context, [
          {
            sourceId: 1,
            chunkId: '122-5#0',
            articleNumber: '122-5',
            chunkIndex: 0,
          },
        ]),
        makeEvaluatedResult('q021', true, context, [
          {
            sourceId: 1,
            chunkId: '122-5#0',
            articleNumber: '122-5',
            chunkIndex: 0,
          },
        ]),
      ]),
      {
        judgeSources,
        judgeModel: 'judge-test',
        createdAt: '2026-01-03T00:00:00.000Z',
      },
    );

    expect(judgeSources).toHaveBeenCalledTimes(2);
    expect(report.results[0]?.judge?.correctness).toBe(4);
    expect(report.results[0]?.sourceJudge).toEqual({
      sourceRelevance: 4,
      sourceCoverage: 2,
      explanation: 'Sources for q001',
    });
    expect(report.sourceEvaluation).toEqual({
      type: 'llm-as-a-judge-sources',
      judgeModel: 'judge-test',
      createdAt: '2026-01-03T00:00:00.000Z',
    });
  });
});
