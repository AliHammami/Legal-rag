import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { EvaluationError } from '../evaluation.error.js';
import type { E2EEvaluationReport } from '../e2e-evaluation.types.js';
import { parseE2EEvaluationReport } from '../load-e2e-evaluation-results.js';
import {
  formatE2EJudgeSummary,
  runE2EJudge,
  summarizeE2EJudgeReport,
  writeE2EEvaluatedReport,
} from '../run-e2e-judge.js';

const tempDirs: string[] = [];

afterEach(() => {
  tempDirs.length = 0;
});

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
    referenceAnswer: expectedAbstention ? null : 'Réponse de référence.',
    generatedAnswer: expectedAbstention
      ? 'Le contexte ne permet pas de répondre.'
      : 'Réponse générée.',
    context: 'Contexte LLM',
    retrievedChunks: [],
    rerankedChunks: [],
    filteredContextChunks: [],
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
      answerPipelineTotalMs: 0,
    },
    rerankStatus: 'success',
  };
}

function makeReport(resultCount: number): E2EEvaluationReport {
  const results = Array.from({ length: resultCount }, (_, index) => {
    const id = `q${String(index + 1).padStart(3, '0')}`;
    return makeSuccessResult(id, index >= resultCount - 1);
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

describe('runE2EJudge', () => {
  it('processes all questions sequentially and preserves original results', async () => {
    const judgeQuestion = vi.fn(async (input) => ({
      questionId: input.questionId,
      correctness: 4,
      completeness: 4,
      groundedness: 4,
      abstentionCorrect: true,
      explanation: `Jugement pour ${input.questionId}`,
    }));

    const report = makeReport(25);
    const evaluated = await runE2EJudge(report, {
      judgeQuestion,
      judgeModel: 'judge-test',
      createdAt: '2026-01-02T00:00:00.000Z',
    });

    expect(judgeQuestion).toHaveBeenCalledTimes(25);
    expect(evaluated.results).toHaveLength(25);
    expect(evaluated.results[0]?.generatedAnswer).toBe('Réponse générée.');
    expect(evaluated.results[0]?.judge).toEqual({
      correctness: 4,
      completeness: 4,
      groundedness: 4,
      abstentionCorrect: true,
      explanation: 'Jugement pour q001',
    });
    expect(evaluated.metadata).toEqual(report.metadata);
    expect(evaluated.evaluation).toEqual({
      type: 'llm-as-a-judge',
      judgeModel: 'judge-test',
      createdAt: '2026-01-02T00:00:00.000Z',
      criteria: ['correctness', 'completeness', 'groundedness', 'abstention'],
    });
  });

  it('calls the judge in sequential order', async () => {
    const callOrder: string[] = [];
    const judgeQuestion = vi.fn(async (input) => {
      callOrder.push(input.questionId);
      return {
        questionId: input.questionId,
        correctness: 3,
        completeness: 3,
        groundedness: 3,
        abstentionCorrect: true,
        explanation: 'ok',
      };
    });

    await runE2EJudge(makeReport(3), {
      judgeQuestion,
      judgeModel: 'judge-test',
      createdAt: '2026-01-02T00:00:00.000Z',
    });

    expect(callOrder).toEqual(['q001', 'q002', 'q003']);
  });

  it('throws explicitly when the judge fails', async () => {
    const judgeQuestion = vi
      .fn()
      .mockResolvedValueOnce({
        questionId: 'q001',
        correctness: 4,
        completeness: 4,
        groundedness: 4,
        abstentionCorrect: true,
        explanation: 'ok',
      })
      .mockRejectedValueOnce(new EvaluationError('Judge failed', 'JUDGE_API_ERROR'));

    await expect(
      runE2EJudge(makeReport(2), {
        judgeQuestion,
        judgeModel: 'judge-test',
        createdAt: '2026-01-02T00:00:00.000Z',
      }),
    ).rejects.toThrow(EvaluationError);
  });

  it('rejects pipeline error results before judging', async () => {
    const report = makeReport(1);
    report.results[0] = {
      status: 'error',
      id: 'q001',
      question: 'Question q001',
      expectedAbstention: false,
      goldArticles: ['122-5'],
      referenceAnswer: 'Référence',
      error: {
        message: 'Pipeline failed',
        code: 'PIPELINE_ERROR',
      },
    };

    await expect(
      runE2EJudge(report, {
        judgeQuestion: vi.fn(),
        judgeModel: 'judge-test',
        createdAt: '2026-01-02T00:00:00.000Z',
      }),
    ).rejects.toThrow(/Cannot judge question q001/);
  });
});

describe('writeE2EEvaluatedReport', () => {
  it('serializes evaluated results with metadata and evaluation block', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'penal-e2e-judge-'));
    tempDirs.push(dir);
    const outputPath = join(dir, 'evaluated.json');

    const evaluated = await runE2EJudge(makeReport(1), {
      judgeQuestion: vi.fn(async (input) => ({
        questionId: input.questionId,
        correctness: 4,
        completeness: 4,
        groundedness: 4,
        abstentionCorrect: true,
        explanation: 'ok',
      })),
      judgeModel: 'judge-test',
      createdAt: '2026-01-02T00:00:00.000Z',
    });

    await writeE2EEvaluatedReport(outputPath, evaluated);

    const raw = await readFile(outputPath, 'utf-8');
    const parsed = parseE2EEvaluationReport(JSON.parse(raw) as unknown);

    expect(parsed.metadata.questionCount).toBe(1);
    expect(JSON.parse(raw)).toMatchObject({
      evaluation: {
        type: 'llm-as-a-judge',
        judgeModel: 'judge-test',
      },
      results: [
        {
          id: 'q001',
          judge: {
            correctness: 4,
          },
        },
      ],
    });
  });
});

describe('summarizeE2EJudgeReport', () => {
  it('formats the CLI summary', async () => {
    const evaluated = await runE2EJudge(makeReport(25), {
      judgeQuestion: vi.fn(async (input) => ({
        questionId: input.questionId,
        correctness: 4,
        completeness: 4,
        groundedness: 4,
        abstentionCorrect: true,
        explanation: 'ok',
      })),
      judgeModel: 'judge-test',
      createdAt: '2026-01-02T00:00:00.000Z',
    });

    const summary = summarizeE2EJudgeReport(
      evaluated,
      'data/evaluation/results/code-penal.e2e.evaluated.json',
    );

    expect(summary.questionCount).toBe(25);
    expect(summary.evaluatedCount).toBe(25);
    expect(summary.errorCount).toBe(0);
    expect(formatE2EJudgeSummary(summary)).toContain('Evaluated: 25');
  });
});
