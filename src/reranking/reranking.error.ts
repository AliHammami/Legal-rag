export class RerankingError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'RerankingError';
  }
}

export function isFallbackEligibleRerankingError(
  error: unknown,
): error is RerankingError {
  return (
    error instanceof RerankingError &&
    error.code !== 'CONFIG_MISSING' &&
    error.code !== 'DOCUMENTS_EMPTY'
  );
}

export function formatRerankingFailureMessage(error: unknown): string {
  if (!(error instanceof RerankingError)) {
    return error instanceof Error ? error.message : 'unknown error';
  }

  if (error.code === 'API_ERROR' && typeof error.cause === 'string') {
    try {
      const parsed = JSON.parse(error.cause) as {
        code?: string;
        detail?: string;
      };
      if (parsed.code) {
        return `${error.message} ${parsed.code}`;
      }
      if (parsed.detail) {
        return `${error.message} ${parsed.detail}`;
      }
    } catch {
      // fall through to base message
    }
  }

  return error.message;
}

export function getJinaApiErrorCode(error: unknown): string | undefined {
  if (!(error instanceof RerankingError) || typeof error.cause !== 'string') {
    return undefined;
  }

  try {
    const parsed = JSON.parse(error.cause) as { code?: string };
    return typeof parsed.code === 'string' ? parsed.code : undefined;
  } catch {
    return undefined;
  }
}

export function isRetryableJinaRateLimitError(error: unknown): boolean {
  if (!(error instanceof RerankingError) || error.code !== 'API_ERROR') {
    return false;
  }

  if (error.message.includes('HTTP 429')) {
    return true;
  }

  if (typeof error.cause === 'string') {
    const lowerCause = error.cause.toLowerCase();
    return (
      lowerCause.includes('429') ||
      lowerCause.includes('rate_concurrency_limit_exceeded') ||
      lowerCause.includes('rate_token_limit_exceeded') ||
      lowerCause.includes('rate limit') ||
      lowerCause.includes('too many requests')
    );
  }

  return false;
}
