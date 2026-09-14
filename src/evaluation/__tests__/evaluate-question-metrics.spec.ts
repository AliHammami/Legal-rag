import { describe, expect, it } from 'vitest';
import { evaluateQuestionMetrics } from '../evaluate-question-metrics.js';

describe('evaluateQuestionMetrics', () => {
  it('computes recall and MRR for vector and Jina outputs', () => {
    const metrics = evaluateQuestionMetrics({
      goldArticles: ['122-5'],
      vectorTop20Articles: ['462-9', '221-1', '122-5', ...Array.from({ length: 17 }, () => '999-1')],
      vectorTop5Articles: ['462-9', '221-1', '122-5', '122-6', '122-7'],
      jinaTop5Articles: ['122-5', '462-9', '221-1', '122-6', '122-7'],
    });

    expect(metrics.recallAt20Vector).toBe(1);
    expect(metrics.recallAt5Vector).toBe(1);
    expect(metrics.recallAt5Jina).toBe(1);
    expect(metrics.mrrVector).toBeCloseTo(0.333, 3);
    expect(metrics.mrrJina).toBe(1);
  });

  it('detects gold present in top 20 but missing from top 5 vector results', () => {
    const metrics = evaluateQuestionMetrics({
      goldArticles: ['121-5'],
      vectorTop20Articles: [
        '462-9',
        '221-1',
        '122-5',
        '122-6',
        '122-7',
        '121-5',
        ...Array.from({ length: 14 }, () => '999-1'),
      ],
      vectorTop5Articles: ['462-9', '221-1', '122-5', '122-6', '122-7'],
      jinaTop5Articles: ['121-5', '462-9', '221-1', '122-5', '122-6'],
    });

    expect(metrics.recallAt20Vector).toBe(1);
    expect(metrics.recallAt5Vector).toBe(0);
    expect(metrics.recallAt5Jina).toBe(1);
  });
});
