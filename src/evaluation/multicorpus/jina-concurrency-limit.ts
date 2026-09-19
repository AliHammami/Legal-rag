import {
  formatRerankingFailureMessage,
  getJinaApiErrorCode,
  isRetryableJinaRateLimitError,
} from '../../reranking/reranking.error.js';
import type { RerankerService } from '../../reranking/reranker.service.js';
import {
  DEFAULT_JINA_CONCURRENCY_LIMIT_COOLDOWN_MS,
  DEFAULT_JINA_MAX_RETRIES,
  DEFAULT_JINA_MIN_INTERVAL_MS,
  DEFAULT_JINA_RETRY_BASE_DELAY_MS,
  DEFAULT_JINA_TOKEN_LIMIT_COOLDOWN_MS,
} from './evaluation-config.js';

export class ConcurrencyLimiter {
  private active = 0;
  private readonly queue: Array<() => void> = [];

  constructor(private readonly limit: number) {
    if (!Number.isInteger(limit) || limit < 1) {
      throw new Error(`Invalid concurrency limit: ${limit}`);
    }
  }

  get activeCount(): number {
    return this.active;
  }

  get waitingCount(): number {
    return this.queue.length;
  }

  async run<T>(operation: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await operation();
    } finally {
      this.release();
    }
  }

  private acquire(): Promise<void> {
    if (this.active < this.limit) {
      this.active += 1;
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      this.queue.push(() => {
        this.active += 1;
        resolve();
      });
    });
  }

  private release(): void {
    this.active -= 1;
    const next = this.queue.shift();
    if (next) {
      next();
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createConcurrencyLimiter(limit: number): ConcurrencyLimiter {
  return new ConcurrencyLimiter(limit);
}

export function createJinaLimitedRerankerService(
  reranker: RerankerService,
  limiter: ConcurrencyLimiter,
): RerankerService {
  return {
    rerank: (query, documents, options) =>
      limiter.run(() => reranker.rerank(query, documents, options)),
  };
}

export interface JinaEvaluationRerankerOptions {
  concurrencyLimit: number;
  maxRetries?: number;
  retryBaseDelayMs?: number;
  minIntervalMs?: number;
  tokenLimitCooldownMs?: number;
  concurrencyLimitCooldownMs?: number;
}

export function getJinaRateLimitRetryDelayMs(
  error: unknown,
  attempt: number,
  options: Pick<
    JinaEvaluationRerankerOptions,
    'retryBaseDelayMs' | 'tokenLimitCooldownMs' | 'concurrencyLimitCooldownMs'
  >,
): number {
  const retryBaseDelayMs = options.retryBaseDelayMs ?? DEFAULT_JINA_RETRY_BASE_DELAY_MS;
  const tokenLimitCooldownMs =
    options.tokenLimitCooldownMs ?? DEFAULT_JINA_TOKEN_LIMIT_COOLDOWN_MS;
  const concurrencyLimitCooldownMs =
    options.concurrencyLimitCooldownMs ?? DEFAULT_JINA_CONCURRENCY_LIMIT_COOLDOWN_MS;

  const apiCode = getJinaApiErrorCode(error);
  if (apiCode === 'RATE_TOKEN_LIMIT_EXCEEDED') {
    return tokenLimitCooldownMs;
  }
  if (apiCode === 'RATE_CONCURRENCY_LIMIT_EXCEEDED') {
    return concurrencyLimitCooldownMs;
  }

  return retryBaseDelayMs * 2 ** attempt;
}

/** Shared scheduler: global cooldown + min spacing between Jina calls for one benchmark run. */
export class JinaEvaluationScheduler {
  private cooldownUntil = 0;
  private lastCallFinishedAt = 0;

  constructor(
    private readonly limiter: ConcurrencyLimiter,
    private readonly options: Required<
      Pick<
        JinaEvaluationRerankerOptions,
        | 'maxRetries'
        | 'retryBaseDelayMs'
        | 'minIntervalMs'
        | 'tokenLimitCooldownMs'
        | 'concurrencyLimitCooldownMs'
      >
    >,
  ) {}

  get cooldownUntilMs(): number {
    return this.cooldownUntil;
  }

  extendCooldown(untilMs: number): void {
    this.cooldownUntil = Math.max(this.cooldownUntil, untilMs);
  }

  private async waitForSharedCooldown(): Promise<void> {
    const waitMs = this.cooldownUntil - Date.now();
    if (waitMs > 0) {
      await sleep(waitMs);
    }
  }

  private async waitForMinInterval(): Promise<void> {
    const elapsedMs = Date.now() - this.lastCallFinishedAt;
    const waitMs = this.options.minIntervalMs - elapsedMs;
    if (waitMs > 0) {
      await sleep(waitMs);
    }
  }

  async runRerank(
    reranker: RerankerService,
    query: string,
    documents: Parameters<RerankerService['rerank']>[1],
    rerankOptions?: Parameters<RerankerService['rerank']>[2],
  ): Promise<Awaited<ReturnType<RerankerService['rerank']>>> {
    for (let attempt = 0; attempt <= this.options.maxRetries; attempt++) {
      await this.waitForSharedCooldown();
      await this.waitForMinInterval();

      try {
        const results = await this.limiter.run(() =>
          reranker.rerank(query, documents, rerankOptions),
        );
        this.lastCallFinishedAt = Date.now();
        return results;
      } catch (error) {
        if (!isRetryableJinaRateLimitError(error) || attempt >= this.options.maxRetries) {
          throw error;
        }

        const delayMs = getJinaRateLimitRetryDelayMs(error, attempt, this.options);
        this.extendCooldown(Date.now() + delayMs);
        console.warn(
          `Jina rerank retry ${attempt + 1}/${this.options.maxRetries} in ${delayMs}ms (shared cooldown): ${formatRerankingFailureMessage(error)}`,
        );
      }
    }

    throw new Error('Jina rerank retries exhausted');
  }
}

export function createJinaEvaluationRerankerService(
  reranker: RerankerService,
  options: JinaEvaluationRerankerOptions,
): RerankerService {
  const scheduler = new JinaEvaluationScheduler(
    createConcurrencyLimiter(options.concurrencyLimit),
    {
      maxRetries: options.maxRetries ?? DEFAULT_JINA_MAX_RETRIES,
      retryBaseDelayMs: options.retryBaseDelayMs ?? DEFAULT_JINA_RETRY_BASE_DELAY_MS,
      minIntervalMs: options.minIntervalMs ?? DEFAULT_JINA_MIN_INTERVAL_MS,
      tokenLimitCooldownMs:
        options.tokenLimitCooldownMs ?? DEFAULT_JINA_TOKEN_LIMIT_COOLDOWN_MS,
      concurrencyLimitCooldownMs:
        options.concurrencyLimitCooldownMs ?? DEFAULT_JINA_CONCURRENCY_LIMIT_COOLDOWN_MS,
    },
  );

  return {
    rerank: (query, documents, rerankOptions) =>
      scheduler.runRerank(reranker, query, documents, rerankOptions),
  };
}
