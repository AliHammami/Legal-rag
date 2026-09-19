import { describe, expect, it } from 'vitest';

import { countE2ERerankFallbacks } from '../multicorpus/aggregate-results.js';
import type { E2EQuestionResult } from '../multicorpus/types.js';

function makeE2EResult(
  questionId: string,
  baselineStatus: 'success' | 'fallback',
  routingStatus: 'success' | 'fallback',
): E2EQuestionResult {
  const profiling = (rerankStatus: 'success' | 'fallback') => ({
    routingMs: 0,
    embeddingMs: 0,
    vectorSearchMs: 0,
    jinaRerankingMs: rerankStatus === 'fallback' ? 0 : 100,
    mappingMs: 0,
    totalMs: 100,
    rerankStatus,
  });

  return {
    questionId,
    questionType: 'single-corpus',
    difficulty: 'easy',
    expectedAbstention: false,
    baseline: {
      answer: 'baseline',
      sources: [],
      profiling: profiling(baselineStatus),
    },
    routing: {
      answer: 'routing',
      sources: [],
      profiling: profiling(routingStatus),
    },
    failureStage: 'none',
  };
}

describe('countE2ERerankFallbacks', () => {
  it('counts fallback variants across baseline and routing', () => {
    const results = [
      makeE2EResult('q001', 'success', 'success'),
      makeE2EResult('q002', 'fallback', 'success'),
      makeE2EResult('q003', 'success', 'fallback'),
    ];

    expect(countE2ERerankFallbacks(results)).toBe(2);
  });
});
