const RETRYABLE_RERANKING_ERROR_CODES = new Set([
  'RESPONSE_INVALID',
  'RESPONSE_INCOMPLETE',
  'CHUNK_UNKNOWN',
  'CHUNK_DUPLICATE',
  'CHUNK_MISSING',
]);

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

export function isRetryableRerankingError(
  error: unknown,
): error is RerankingError {
  return (
    error instanceof RerankingError &&
    RETRYABLE_RERANKING_ERROR_CODES.has(error.code)
  );
}
