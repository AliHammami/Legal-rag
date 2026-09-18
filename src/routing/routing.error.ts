export class RoutingError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'RoutingError';
  }
}

export function isRoutingError(error: unknown): error is RoutingError {
  return error instanceof RoutingError;
}
