export type RetrievalStrategy = 'vector' | 'hybrid-union';

export const RETRIEVAL_STRATEGY_ENV = 'RETRIEVAL_STRATEGY';
export const DEFAULT_RETRIEVAL_STRATEGY: RetrievalStrategy = 'vector';

export function parseRetrievalStrategy(
  raw: string | undefined,
): RetrievalStrategy {
  const normalized = raw?.trim().toLowerCase();
  if (!normalized || normalized === 'vector') {
    return 'vector';
  }
  if (normalized === 'hybrid-union' || normalized === 'hybrid_union') {
    return 'hybrid-union';
  }
  throw new Error(
    `Invalid ${RETRIEVAL_STRATEGY_ENV}: ${raw}. Expected "vector" or "hybrid-union".`,
  );
}

export function resolveRetrievalStrategy(
  env: NodeJS.ProcessEnv = process.env,
): RetrievalStrategy {
  return parseRetrievalStrategy(env[RETRIEVAL_STRATEGY_ENV]);
}
