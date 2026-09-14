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
