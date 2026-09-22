import { describe, expect, it } from 'vitest';

import {
  classifyRegressionDecision,
  detectRegressionFindings,
} from '../multicorpus/retrieval-top30-regression-report.js';
import type { RetrievalTop30SmokeQuestionResult } from '../multicorpus/retrieval-top30-smoke-pipeline.js';

function minimalResult(
  overrides: Partial<RetrievalTop30SmokeQuestionResult>,
): RetrievalTop30SmokeQuestionResult {
  return {
    questionId: 'q334',
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
      correctness: 4,
      completeness: 4,
      groundedness: 4,
      abstentionCorrect: true,
      explanation: '',
    },
    sourceJudge: {
      sourceRelevance: 4,
      sourceCoverage: 4,
      explanation: '',
    },
    metrics: {
      retrievalGoldRecallAt20: 0,
      retrievalGoldRecallAt30: 1,
      retrievalFullCoverageAt20: false,
      retrievalFullCoverageAt30: true,
      retrievalCorpusCoverageAt30: 1,
      goldNewInRanks21To30: [{ corpusId: 'code-penal', articleNumber: '1' }],
      finalContextGoldHits: [{ corpusId: 'code-penal', articleNumber: '1' }],
      finalContextFullCoverage: true,
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

describe('retrieval-top30-regression-report', () => {
  it('flags abstention regression when retrieval runs', () => {
    const findings = detectRegressionFindings({
      results: [
        minimalResult({
          questionId: 'q401',
          questionType: 'out-of-scope',
          routing: { decision: 'abstain', corpusIds: [], abstain: true },
          retrieval: [{ rank: 1, chunkId: '1', articleNumber: '1', corpusId: 'c', distance: 0.1 }],
        }),
      ],
      baselineByQuestion: new Map(),
      smokeTop30ByQuestion: new Map(),
    });
    expect(findings.some((finding) => finding.kind === 'abstention_regression')).toBe(
      true,
    );
  });

  it('does not flag OOS abstention when baseline was already incorrect', () => {
    const findings = detectRegressionFindings({
      results: [
        minimalResult({
          questionId: 'q466',
          questionType: 'out-of-scope',
          routing: { decision: 'routed', corpusIds: ['code-civil'] },
          retrieval: [{ rank: 1, chunkId: '1', articleNumber: '1', corpusId: 'code-civil', distance: 0.1 }],
          judge: {
            correctness: 4,
            completeness: 4,
            groundedness: 4,
            abstentionCorrect: false,
            explanation: '',
          },
        }),
      ],
      baselineByQuestion: new Map([
        [
          'q466',
          {
            source: 'e2e500_routing',
            correctness: 4,
            completeness: 4,
            groundedness: 4,
            sourceRelevance: 4,
            sourceCoverage: 4,
            abstentionCorrect: false,
          },
        ],
      ]),
      smokeTop30ByQuestion: new Map(),
    });
    expect(findings).toHaveLength(0);
  });

  it('classifies NO_REGRESSION when topK gains hold', () => {
    const decision = classifyRegressionDecision({
      findings: [],
      topk30Results: [
        minimalResult({ questionId: 'q334' }),
        minimalResult({ questionId: 'q367' }),
        minimalResult({ questionId: 'q378' }),
      ],
    });
    expect(decision.category).toBe('NO_REGRESSION');
  });
});
