import { describe, expect, it } from 'vitest';

import {
  aggregateHybridVariantMetrics,
  classifyHybridSmokeDecision,
} from '../multicorpus/retrieval-hybrid-rerank-filter-smoke.js';

describe('retrieval-hybrid-rerank-filter-smoke', () => {
  it('aggregates stage recalls', () => {
    const agg = aggregateHybridVariantMetrics([
      {
        variant: 'vector',
        candidateCount: 50,
        retrieval: {
          goldHits: 2,
          goldTotal: 2,
          goldRecall: 1,
          fullCoverage: true,
          corpusCoverage: null,
          corpusTotal: null,
          chunkCount: 50,
        },
        afterJina: {
          goldHits: 1,
          goldTotal: 2,
          goldRecall: 0.5,
          fullCoverage: false,
          corpusCoverage: null,
          corpusTotal: null,
          chunkCount: 5,
        },
        afterFilter: {
          goldHits: 1,
          goldTotal: 2,
          goldRecall: 0.5,
          fullCoverage: false,
          corpusCoverage: null,
          corpusTotal: null,
          chunkCount: 2,
        },
        jinaTop5: [],
        filterRows: [],
        finalContextChunkIds: [],
      },
    ]);
    expect(agg.avgRetrievalRecall).toBe(1);
    expect(agg.avgJinaRecall).toBe(0.5);
    expect(agg.avgFilterRecall).toBe(0.5);
  });

  it('classifies need generation when union filter beats vector', () => {
    const decision = classifyHybridSmokeDecision({
      vectorFilterRecall: 0.5,
      unionFilterRecall: 0.55,
      rrfFilterRecall: 0.52,
      vectorRetrievalRecall: 0.6,
      unionRetrievalRecall: 0.7,
      bm25OnlySurviveFilter: 3,
      bm25OnlyAtUnionRetrieval: 5,
    });
    expect(decision.category).toBe('NEED_GENERATION_VALIDATION');
  });
});
