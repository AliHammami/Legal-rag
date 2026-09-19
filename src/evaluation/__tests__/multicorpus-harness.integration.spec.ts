import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { FIXTURE_MULTICORPUS_QUESTIONS } from './fixtures/multicorpus-dataset.fixture.js';
import { buildMulticorpusEvaluationReports } from '../multicorpus/aggregate-results.js';
import {
  buildDefaultModelConfiguration,
  parseMulticorpusEvaluationCliOptions,
  resolveMulticorpusRunDirectory,
} from '../multicorpus/evaluation-config.js';
import {
  buildMulticorpusCacheKey,
  loadCachedPhaseResults,
  readCachedResult,
  writeCachedResult,
} from '../multicorpus/cache.js';
import { formatMulticorpusEvaluationMarkdown } from '../multicorpus/write-evaluation-report.js';
import type {
  E2EQuestionResult,
  MulticorpusRunMetadata,
  RerankingQuestionResult,
  RetrievalQuestionResult,
  RoutingQuestionResult,
} from '../multicorpus/types.js';

describe('multicorpus evaluation harness integration', () => {
  it('parses CLI options for selective evaluation modes', () => {
    const options = parseMulticorpusEvaluationCliOptions([
      '--all',
      '--limit',
      '5',
      '--concurrency',
      '2',
      '--resume',
      '2026-09-18T21-05-25-814Z',
    ]);

    expect(options.modes).toEqual(
      new Set(['routing', 'retrieval', 'reranking', 'e2e']),
    );
    expect(options.limit).toBe(5);
    expect(options.concurrency).toBe(2);
    expect(options.resume).toBe('2026-09-18T21-05-25-814Z');
  });

  it('changes cache keys when model configuration changes', () => {
    const baseConfig = buildDefaultModelConfiguration();
    const alteredConfig = buildDefaultModelConfiguration({
      routingModel: 'gpt-test',
    });

    const baseKey = buildMulticorpusCacheKey({
      questionId: 'q001',
      mode: 'routing',
      modelConfiguration: baseConfig,
    });
    const alteredKey = buildMulticorpusCacheKey({
      questionId: 'q001',
      mode: 'routing',
      modelConfiguration: alteredConfig,
    });

    expect(baseKey).not.toBe(alteredKey);
  });

  it('aggregates mock evaluator outputs into a markdown report', () => {
    const questions = FIXTURE_MULTICORPUS_QUESTIONS.slice(0, 3);
    const metadata: MulticorpusRunMetadata = {
      datasetVersion: 'test',
      datasetPath: 'data/evaluation/legal-multicorpus.questions.json',
      timestamp: '2026-09-18T00:00:00.000Z',
      evaluatorVersion: '1.0.0',
      modelConfiguration: buildDefaultModelConfiguration(),
      evaluationConcurrency: 3,
      jinaConcurrency: 2,
      questionCount: questions.length,
      limit: 3,
    };

    const routingResults: RoutingQuestionResult[] = questions.map((question) => ({
      questionId: question.id,
      questionType: question.questionType,
      difficulty: question.difficulty,
      goldCorpusIds: question.goldCorpusIds,
      predictedCorpusIds: question.goldCorpusIds,
      exactMatch: true,
      precision: 1,
      recall: 1,
      f1: 1,
      latencyMs: 100,
      fallbackToGlobal: false,
    }));

    const retrievalResults: RetrievalQuestionResult[] = questions.map((question) => ({
      questionId: question.id,
      questionType: question.questionType,
      difficulty: question.difficulty,
      goldArticles: question.goldArticles,
      global: { recallAt5: 0.5, recallAt10: 0.75, recallAt20: 1, mrr: 0.5 },
      routed: { recallAt5: 1, recallAt10: 1, recallAt20: 1, mrr: 1 },
      latencyMs: { global: 120, routed: 150 },
    }));

    const rerankingResults: RerankingQuestionResult[] = questions.map((question) => ({
      questionId: question.id,
      questionType: question.questionType,
      difficulty: question.difficulty,
      goldArticles: question.goldArticles,
      vectorTop5: { recallAt5: 0.5, recallAt10: 0.5, recallAt20: 0.5, mrr: 0.5 },
      jinaTop5: { recallAt5: 1, recallAt10: 1, recallAt20: 1, mrr: 1 },
      rerankEffect: 'improved' as const,
      latencyMs: 80,
    }));

    const e2eResults: E2EQuestionResult[] = questions.map((question) => ({
      questionId: question.id,
      questionType: question.questionType,
      difficulty: question.difficulty,
      expectedAbstention:
        question.questionType === 'ambiguous' ||
        question.questionType === 'out-of-scope',
      baseline: {
        answer: 'baseline',
        sources: question.goldArticles,
        profiling: {
          routingMs: 0,
          embeddingMs: 10,
          retrievalMs: 20,
          rerankingMs: 30,
          generationMs: 40,
          totalMs: 100,
        },
      },
      routing: {
        answer: 'routing',
        sources: question.goldArticles,
        profiling: {
          routingMs: 15,
          embeddingMs: 10,
          retrievalMs: 20,
          rerankingMs: 30,
          generationMs: 40,
          totalMs: 115,
        },
      },
      failureStage: 'none' as const,
    }));

    const report = buildMulticorpusEvaluationReports({
      metadata,
      questions,
      routing: routingResults,
      retrieval: retrievalResults,
      reranking: rerankingResults,
      e2e: e2eResults,
    });

    const markdown = formatMulticorpusEvaluationMarkdown(report);

    expect(markdown).toContain('# Multi-corpus RAG Evaluation');
    expect(markdown).toContain('## Routing');
    expect(markdown).toContain('## Retrieval');
    expect(markdown).toContain('## Reranking');
    expect(markdown).toContain('## E2E');
    expect(report.errors?.byStage.none).toBeGreaterThanOrEqual(0);
  });

  it('resolves resume run directories and loads complete phase caches', async () => {
    const runDir = await mkdtemp(join(tmpdir(), 'multicorpus-resume-'));
    const modelConfiguration = buildDefaultModelConfiguration();
    const questions = FIXTURE_MULTICORPUS_QUESTIONS.slice(0, 2);

    for (const question of questions) {
      const cacheKey = buildMulticorpusCacheKey({
        questionId: question.id,
        mode: 'routing',
        modelConfiguration,
      });
      await writeCachedResult(runDir, 'routing', cacheKey, {
        questionId: question.id,
        exactMatch: true,
      });
    }

    const resolved = await resolveMulticorpusRunDirectory({
      resultsDir: tmpdir(),
      resume: runDir,
    });

    expect(resolved.resumed).toBe(true);
    expect(resolved.runDir).toBe(runDir);

    const loaded = await loadCachedPhaseResults<{
      questionId: string;
      exactMatch: boolean;
    }>(runDir, 'routing', questions, modelConfiguration);

    expect(loaded).toHaveLength(2);
    expect(loaded?.every((result) => result.exactMatch)).toBe(true);

    await rm(runDir, { recursive: true, force: true });
  });

  it('returns undefined when a phase cache is incomplete', async () => {
    const runDir = await mkdtemp(join(tmpdir(), 'multicorpus-partial-'));
    const modelConfiguration = buildDefaultModelConfiguration();
    const questions = FIXTURE_MULTICORPUS_QUESTIONS.slice(0, 2);

    const cacheKey = buildMulticorpusCacheKey({
      questionId: questions[0]!.id,
      mode: 'routing',
      modelConfiguration,
    });
    await writeCachedResult(runDir, 'routing', cacheKey, {
      questionId: questions[0]!.id,
      exactMatch: true,
    });

    const loaded = await loadCachedPhaseResults(
      runDir,
      'routing',
      questions,
      modelConfiguration,
    );

    expect(loaded).toBeUndefined();

    await rm(runDir, { recursive: true, force: true });
  });

  it('persists and reloads cached evaluator results', async () => {
    const runDir = await mkdtemp(join(tmpdir(), 'multicorpus-cache-'));
    const cacheKey = buildMulticorpusCacheKey({
      questionId: 'q001',
      mode: 'routing',
      modelConfiguration: buildDefaultModelConfiguration(),
    });

    await writeCachedResult(runDir, 'routing', cacheKey, { exactMatch: true });
    const cached = await readCachedResult<{ exactMatch: boolean }>(
      runDir,
      'routing',
      cacheKey,
    );

    expect(cached?.exactMatch).toBe(true);

    const raw = await readFile(
      join(runDir, 'routing-cache', `${cacheKey}.json`),
      'utf-8',
    );
    expect(raw).toContain('"exactMatch": true');

    await rm(runDir, { recursive: true, force: true });
  });
});
