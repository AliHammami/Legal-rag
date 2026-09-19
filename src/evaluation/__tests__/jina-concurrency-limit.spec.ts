import { describe, expect, it, vi } from 'vitest';

import {
  ConcurrencyLimiter,
  JinaEvaluationScheduler,
  createConcurrencyLimiter,
  createJinaEvaluationRerankerService,
  createJinaLimitedRerankerService,
  getJinaRateLimitRetryDelayMs,
} from '../multicorpus/jina-concurrency-limit.js';
import type { RerankerService } from '../../reranking/reranker.service.js';
import {
  RerankingError,
  formatRerankingFailureMessage,
  isRetryableJinaRateLimitError,
} from '../../reranking/reranking.error.js';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createTrackingReranker(activeCounter: { max: number; current: number }) {
  return {
    rerank: vi.fn(async () => {
      activeCounter.current += 1;
      activeCounter.max = Math.max(activeCounter.max, activeCounter.current);
      await delay(40);
      activeCounter.current -= 1;
      return [{ chunkId: 'chunk#0', score: 0.9 }];
    }),
  } satisfies RerankerService;
}

describe('Jina concurrency limiter', () => {
  it('never exceeds jinaConcurrency when evaluationConcurrency is higher', async () => {
    const limiter = createConcurrencyLimiter(2);
    const activeCounter = { max: 0, current: 0 };
    const underlying = createTrackingReranker(activeCounter);
    const reranker = createJinaLimitedRerankerService(underlying, limiter);

    await Promise.all(
      Array.from({ length: 5 }, (_, index) =>
        reranker.rerank(`question-${index}`, [{ chunkId: 'chunk#0', content: 'doc' }]),
      ),
    );

    expect(activeCounter.max).toBeLessThanOrEqual(2);
    expect(underlying.rerank).toHaveBeenCalledTimes(5);
  });

  it('allows Jina calls when evaluationConcurrency is 1', async () => {
    const limiter = createConcurrencyLimiter(2);
    const reranker = createJinaLimitedRerankerService(
      {
        rerank: vi.fn(async () => [{ chunkId: 'chunk#0', score: 1 }]),
      },
      limiter,
    );

    const results = await reranker.rerank('question', [
      { chunkId: 'chunk#0', content: 'doc' },
    ]);

    expect(results).toHaveLength(1);
    expect(limiter.activeCount).toBe(0);
  });

  it('releases slots so queued calls continue after completion', async () => {
    const limiter = new ConcurrencyLimiter(1);
    const order: string[] = [];

    await Promise.all([
      limiter.run(async () => {
        order.push('first-start');
        await delay(20);
        order.push('first-end');
      }),
      limiter.run(async () => {
        order.push('second-start');
      }),
    ]);

    expect(order).toEqual(['first-start', 'first-end', 'second-start']);
    expect(limiter.activeCount).toBe(0);
    expect(limiter.waitingCount).toBe(0);
  });

  it('delegates to the underlying reranker without changing its API', async () => {
    const underlying: RerankerService = {
      rerank: vi.fn(async () => [{ chunkId: '122-5#0', score: 0.88 }]),
    };
    const wrapped = createJinaLimitedRerankerService(
      underlying,
      createConcurrencyLimiter(2),
    );

    const documents = [{ chunkId: '122-5#0', content: 'Article 122-5' }];
    const results = await wrapped.rerank('Question ?', documents, { topN: 1 });

    expect(underlying.rerank).toHaveBeenCalledWith('Question ?', documents, { topN: 1 });
    expect(results).toEqual([{ chunkId: '122-5#0', score: 0.88 }]);
  });
});

describe('Jina evaluation reranker retries', () => {
  it('retries HTTP 429 rate-limit errors before succeeding', async () => {
    const underlying: RerankerService = {
      rerank: vi
        .fn()
        .mockRejectedValueOnce(
          new RerankingError(
            'Jina reranker API returned HTTP 429',
            'API_ERROR',
            JSON.stringify({ code: 'RATE_CONCURRENCY_LIMIT_EXCEEDED' }),
          ),
        )
        .mockResolvedValueOnce([{ chunkId: 'chunk#0', score: 0.9 }]),
    };

    const reranker = createJinaEvaluationRerankerService(underlying, {
      concurrencyLimit: 1,
      maxRetries: 3,
      retryBaseDelayMs: 1,
      minIntervalMs: 0,
      concurrencyLimitCooldownMs: 1,
    });

    const results = await reranker.rerank('question', [
      { chunkId: 'chunk#0', content: 'doc' },
    ]);

    expect(results).toEqual([{ chunkId: 'chunk#0', score: 0.9 }]);
    expect(underlying.rerank).toHaveBeenCalledTimes(2);
  });

  it('uses a long shared cooldown for RATE_TOKEN_LIMIT_EXCEEDED', () => {
    const delayMs = getJinaRateLimitRetryDelayMs(
      new RerankingError(
        'Jina reranker API returned HTTP 429',
        'API_ERROR',
        JSON.stringify({ code: 'RATE_TOKEN_LIMIT_EXCEEDED' }),
      ),
      0,
      {},
    );

    expect(delayMs).toBeGreaterThanOrEqual(60_000);
  });

  it('applies shared cooldown across parallel rerank attempts', async () => {
    vi.useFakeTimers();

    const underlying: RerankerService = {
      rerank: vi
        .fn()
        .mockRejectedValueOnce(
          new RerankingError(
            'Jina reranker API returned HTTP 429',
            'API_ERROR',
            JSON.stringify({ code: 'RATE_TOKEN_LIMIT_EXCEEDED' }),
          ),
        )
        .mockResolvedValueOnce([{ chunkId: 'chunk#0', score: 0.9 }])
        .mockResolvedValueOnce([{ chunkId: 'chunk#1', score: 0.8 }]),
    };

    const scheduler = new JinaEvaluationScheduler(createConcurrencyLimiter(1), {
      maxRetries: 2,
      retryBaseDelayMs: 1,
      minIntervalMs: 0,
      tokenLimitCooldownMs: 1000,
      concurrencyLimitCooldownMs: 1,
    });

    const docs = [{ chunkId: 'chunk#0', content: 'doc' }];
    const first = scheduler.runRerank(underlying, 'q1', docs);
    await vi.advanceTimersByTimeAsync(0);
    const second = scheduler.runRerank(underlying, 'q2', docs);

    await vi.advanceTimersByTimeAsync(1000);
    await Promise.all([first, second]);

    expect(underlying.rerank).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });

  it('detects retryable Jina rate-limit errors', () => {
    expect(
      isRetryableJinaRateLimitError(
        new RerankingError('Jina reranker API returned HTTP 429', 'API_ERROR'),
      ),
    ).toBe(true);
    expect(
      isRetryableJinaRateLimitError(
        new RerankingError('JINA_API_KEY is not configured', 'CONFIG_MISSING'),
      ),
    ).toBe(false);
  });
});

describe('reranking failure observability', () => {
  it('formats API errors without exposing secrets', () => {
    const message = formatRerankingFailureMessage(
      new RerankingError(
        'Jina reranker API returned HTTP 429',
        'API_ERROR',
        JSON.stringify({
          detail: 'Concurrency limit exceeded: 2/2 concurrent requests.',
          code: 'RATE_CONCURRENCY_LIMIT_EXCEEDED',
        }),
      ),
    );

    expect(message).toContain('HTTP 429');
    expect(message).toContain('RATE_CONCURRENCY_LIMIT_EXCEEDED');
    expect(message).not.toContain('jina_');
    expect(message).not.toContain('Bearer');
  });

});
