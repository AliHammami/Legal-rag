import { describe, expect, it } from 'vitest';

import { runFinalRagValidation } from '../final-rag-validation.js';

describe('runFinalRagValidation', () => {
  it('passes when project checks and snapshots are valid', async () => {
    const report = await runFinalRagValidation({
      testsPassed: true,
      buildPassed: true,
      corpusChunkCount: 1368,
      retrievalMetrics: {
        questionCount: 20,
        recallAt20Vector: 1,
        recallAt5Vector: 1,
        recallAt5Jina: 1,
        mrrVector: 0.975,
        mrrJina: 0.975,
        recallAt5ImprovementPoints: 0,
        mrrImprovement: 0,
        averageEmbeddingMs: 100,
        averageVectorSearchMs: 50,
        averageJinaRerankingMs: 200,
        averageTotalMs: 350,
      },
    });

    expect(report.status).toBe('PASS');
    expect(report.e2e.metrics?.questionCount).toBe(25);
    expect(report.sources.metrics?.averageSourceCoverage).toBe(4);
    expect(report.corpusChunkCount).toBe(1368);
  });

  it('fails when tests or build did not pass', async () => {
    const report = await runFinalRagValidation({
      testsPassed: false,
      buildPassed: true,
      corpusChunkCount: 1368,
      retrievalMetrics: {
        questionCount: 20,
        recallAt20Vector: 1,
        recallAt5Vector: 1,
        recallAt5Jina: 1,
        mrrVector: 0.975,
        mrrJina: 0.975,
        recallAt5ImprovementPoints: 0,
        mrrImprovement: 0,
        averageEmbeddingMs: 100,
        averageVectorSearchMs: 50,
        averageJinaRerankingMs: 200,
        averageTotalMs: 350,
      },
    });

    expect(report.status).toBe('FAIL');
    expect(report.failures.some((failure) => failure.includes('tests'))).toBe(
      true,
    );
  });
});
