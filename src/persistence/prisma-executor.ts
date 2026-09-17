/** Minimal Prisma surface used by raw SQL persistence helpers. */
export interface PrismaExecutor {
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
}
