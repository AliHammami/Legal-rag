import { describe, expect, it } from 'vitest';

import {
  aggregateSmokeResults,
  classifyTop30SmokeDecision,
} from '../multicorpus/retrieval-top30-smoke-report.js';
import type { RetrievalTop30SmokeQuestionResult } from '../multicorpus/retrieval-top30-smoke-pipeline.js';

function makeResult(
  overrides: Partial<RetrievalTop30SmokeQuestionResult>,
): RetrievalTop30SmokeQuestionResult {
  return {
    questionId: 'q1',
    question: 'Q',
    questionType: 'multi-corpus',
    goldArticles: [{ corpusId: 'code-penal', articleNumber: '1' }],
    config: {
      retrievalTopK: 30,
      rerankTopK: 5,
      relativeScoreThreshold: 0.4,
      routingModel: 'routing',
    },
    routing: { decision: 'routed', corpusIds: ['code-penal'] },
    retrieval: [],
    reranking: [],
    filter: { threshold: 0.4, rows: [], finalChunkIds: [] },
    finalContext: { chunkIds: [], sources: [], contextPreview: '' },
    generation: { answer: 'a', rerankStatus: 'success' },
    judge: {
      correctness: 3,
      completeness: 3,
      groundedness: 4,
      abstentionCorrect: true,
      explanation: '',
    },
    sourceJudge: {
      sourceRelevance: 3,
      sourceCoverage: 3,
      explanation: '',
    },
    metrics: {
      retrievalGoldRecallAt20: 0,
      retrievalGoldRecallAt30: 0,
      retrievalFullCoverageAt20: false,
      retrievalFullCoverageAt30: false,
      retrievalCorpusCoverageAt30: 0,
      goldNewInRanks21To30: [],
      finalContextGoldHits: [],
      finalContextFullCoverage: false,
    },
    profiling: {
      routingMs: 0,
      embeddingMs: 0,
      vectorSearchMs: 0,
      jinaRerankingMs: 0,
      contextFilteringMs: 0,
      generationMs: 0,
      answerPipelineTotalMs: 0,
      embeddingCalls: 0,
      rerankingCalls: 1,
      generationCalls: 1,
      routingCalls: 1,
    },
    embeddingFromCache: true,
    ...overrides,
  };
}

describe('retrieval-top30-smoke-report', () => {
  it('aggregates marginal gold in ranks 21-30', () => {
    const agg = aggregateSmokeResults([
      makeResult({
        retrieval: [
          {
            rank: 25,
            chunkId: '1#0',
            articleNumber: '1',
            corpusId: 'code-penal',
            distance: 0.2,
          },
        ],
        metrics: {
          retrievalGoldRecallAt20: 0,
          retrievalGoldRecallAt30: 1,
          retrievalFullCoverageAt20: false,
          retrievalFullCoverageAt30: true,
          retrievalCorpusCoverageAt30: 1,
          goldNewInRanks21To30: [
            { corpusId: 'code-penal', articleNumber: '1' },
          ],
          finalContextGoldHits: [],
          finalContextFullCoverage: false,
        },
      }),
    ]);
    expect(agg.goldNewIn21To30Count).toBe(1);
  });

  it('classifies not useful when retrieval gain does not reach final context', () => {
    const decision = classifyTop30SmokeDecision({
      smoke: {
        retrievalGoldRecallAt20: 0.5,
        retrievalGoldRecallAt30: 0.6,
        finalContextGoldRecall: 0.5,
        finalContextFullCoverageRate: 0.2,
        correctness: 3.5,
        completeness: 3.5,
        groundedness: 4,
        sourceRelevance: 3.4,
        sourceCoverage: 3.4,
        abstentionCorrectRate: 1,
        avgLatencyMs: 4000,
        goldNewIn21To30Count: 3,
        goldNewIn21To30InFinalContext: 0,
        goldNewIn21To30InRerankTop5: 0,
      },
      baseline: {
        questionCount: 61,
        correctness: 3.6,
        completeness: 3.6,
        groundedness: 4,
        sourceRelevance: 3.5,
        sourceCoverage: 3.5,
        abstentionCorrectRate: 0.9,
        avgLatencyMs: 4500,
      },
      depthBenchmarkRecallAt20: 0.559,
    });
    expect(decision.category).toBe('TOPK_30_NOT_USEFUL');
  });
});
