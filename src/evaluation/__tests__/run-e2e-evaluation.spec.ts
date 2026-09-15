import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  formatE2EEvaluationSummary,
  runE2EEvaluation,
  summarizeE2EEvaluationReport,
  writeE2EEvaluationReport,
} from '../run-e2e-evaluation.js';
import type { E2EEvaluationQuestion } from '../types.js';
import type { AnswerQuestionResult } from '../../generation/types.js';

const tempDirs: string[] = [];

afterEach(() => {
  tempDirs.length = 0;
});

const normalQuestion: E2EEvaluationQuestion = {
  id: 'q001',
  question: 'Quelles sont les conditions de la légitime défense ?',
  goldArticles: ['122-5', '122-6'],
  referenceAnswer: 'Réponse de référence.',
  expectedAbstention: false,
};

const abstentionQuestion: E2EEvaluationQuestion = {
  id: 'q021',
  question: 'Quelle est la durée légale du préavis en cas de licenciement économique ?',
  goldArticles: [],
  referenceAnswer: null,
  expectedAbstention: true,
};

function makePipelineResult(answer: string): AnswerQuestionResult {
  return {
    question: normalQuestion.question,
    answer,
    context: 'Contexte LLM',
    candidates: [
      {
        chunkId: '122-6#0',
        articleNumber: '122-6',
        content: 'Contenu',
        distance: 0.35,
        metadata: {
          articleNumber: '122-6',
          pageStart: 1,
          pageEnd: 1,
          source: 'data/code-penal.pdf',
          sourceType: 'pdf',
          chunkIndex: 0,
          chunkCount: 1,
          unitStart: 0,
          unitEnd: 0,
          unitCount: 1,
        },
      },
    ],
    reranked: [
      {
        chunkId: '122-6#0',
        articleNumber: '122-6',
        content: 'Contenu',
        distance: 0.35,
        rerankScore: 0.9,
        metadata: {
          articleNumber: '122-6',
          pageStart: 1,
          pageEnd: 1,
          source: 'data/code-penal.pdf',
          sourceType: 'pdf',
          chunkIndex: 0,
          chunkCount: 1,
          unitStart: 0,
          unitEnd: 0,
          unitCount: 1,
        },
      },
    ],
    rerankStatus: 'success',
    contextFiltering: {
      jinaResults: 1,
      contextResults: 1,
      relativeScoreThreshold: 0.4,
    },
    sources: [
      {
        sourceId: 1,
        chunkId: '122-6#0',
        articleNumber: '122-6',
        chunkIndex: 0,
        content: 'Contenu',
        chunk: {
          chunkId: '122-6#0',
          articleNumber: '122-6',
          content: 'Contenu',
          distance: 0.35,
          rerankScore: 0.9,
          metadata: {
            articleNumber: '122-6',
            pageStart: 1,
            pageEnd: 1,
            source: 'data/code-penal.pdf',
            sourceType: 'pdf',
            chunkIndex: 0,
            chunkCount: 1,
            unitStart: 0,
            unitEnd: 0,
            unitCount: 1,
          },
        },
      },
    ],
    profiling: {
      embeddingMs: 100,
      vectorSearchMs: 50,
      jinaRerankingMs: 200,
      mappingMs: 1,
      totalMs: 351,
      embeddingCalls: 1,
      rerankingCalls: 1,
      retrievedCandidates: 1,
      rerankStatus: 'success',
      contextFilteringMs: 1,
      contextBuilderMs: 2,
      generationMs: 3000,
      generationCalls: 1,
      answerPipelineTotalMs: 3354,
    },
  };
}

describe('runE2EEvaluation', () => {
  it('runs all questions sequentially and keeps successful results', async () => {
    const answerQuestion = vi
      .fn()
      .mockResolvedValueOnce(makePipelineResult('Réponse 1'))
      .mockResolvedValueOnce(makePipelineResult('Réponse 2'));

    const report = await runE2EEvaluation(
      [normalQuestion, abstentionQuestion],
      {
        answerQuestion,
        metadata: {
          dataset: 'dataset.json',
          questionCount: 2,
          generationModel: 'gpt-test',
          embeddingModel: 'text-embedding-3-large',
          rerankerModel: 'jina-reranker-v3.5',
          contextThreshold: 0.4,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      },
    );

    expect(answerQuestion).toHaveBeenCalledTimes(2);
    expect(report.results).toHaveLength(2);
    expect(report.results[0]?.status).toBe('success');
    expect(report.results[1]?.status).toBe('success');
    expect(report.metadata.questionCount).toBe(2);
  });

  it('records an error result without stopping the run', async () => {
    const answerQuestion = vi
      .fn()
      .mockRejectedValueOnce(new Error('Pipeline failed'))
      .mockResolvedValueOnce(makePipelineResult('Réponse 2'));

    const report = await runE2EEvaluation([normalQuestion, abstentionQuestion], {
      answerQuestion,
      metadata: {
        dataset: 'dataset.json',
        questionCount: 2,
        generationModel: 'gpt-test',
        embeddingModel: 'text-embedding-3-large',
        rerankerModel: 'jina-reranker-v3.5',
        contextThreshold: 0.4,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    });

    expect(report.results[0]?.status).toBe('error');
    expect(report.results[1]?.status).toBe('success');
  });
});

describe('writeE2EEvaluationReport', () => {
  it('serializes the report to disk', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'penal-e2e-results-'));
    tempDirs.push(dir);
    const outputPath = join(dir, 'results.json');

    await writeE2EEvaluationReport(outputPath, {
      metadata: {
        dataset: 'dataset.json',
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
          question: normalQuestion.question,
          expectedAbstention: false,
          goldArticles: ['122-5'],
          referenceAnswer: 'Réponse de référence.',
          generatedAnswer: 'Réponse générée.',
          context: 'Contexte LLM',
          retrievedChunks: [],
          rerankedChunks: [],
          filteredContextChunks: [],
          contextFiltering: {
            jinaResults: 0,
            contextResults: 0,
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
        },
      ],
    });

    const raw = await readFile(outputPath, 'utf-8');
    const parsed = JSON.parse(raw) as { metadata: { questionCount: number } };

    expect(parsed.metadata.questionCount).toBe(1);
  });
});

describe('summarizeE2EEvaluationReport', () => {
  it('computes success/error counts and averages', () => {
    const summary = summarizeE2EEvaluationReport(
      {
        metadata: {
          dataset: 'dataset.json',
          questionCount: 2,
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
            question: normalQuestion.question,
            expectedAbstention: false,
            goldArticles: ['122-5'],
            referenceAnswer: 'Réponse de référence.',
            generatedAnswer: 'Réponse générée.',
            context: '12345',
            retrievedChunks: [],
            rerankedChunks: [],
            filteredContextChunks: [{ rank: 1, chunkId: '122-6#0', articleNumber: '122-6' }],
            contextFiltering: {
              jinaResults: 1,
              contextResults: 1,
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
              answerPipelineTotalMs: 1000,
            },
            rerankStatus: 'success',
          },
          {
            status: 'error',
            id: 'q021',
            question: abstentionQuestion.question,
            expectedAbstention: true,
            goldArticles: [],
            referenceAnswer: null,
            error: {
              message: 'failed',
              code: 'Error',
            },
          },
        ],
      },
      'data/evaluation/results/code-penal.e2e.results.json',
    );

    expect(summary.successCount).toBe(1);
    expect(summary.errorCount).toBe(1);
    expect(summary.averageContextCharacters).toBe(5);
    expect(summary.averageFilteredContextChunks).toBe(1);
    expect(summary.averageTotalLatencyMs).toBe(1000);
    expect(formatE2EEvaluationSummary(summary)).toContain('Success: 1');
  });
});
