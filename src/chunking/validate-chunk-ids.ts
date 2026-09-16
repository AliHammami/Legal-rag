export function findDuplicateChunkIds(
  chunks: readonly { chunkId: string }[],
): string[] {
  const seen = new Map<string, number>();
  const duplicates = new Set<string>();

  for (const chunk of chunks) {
    const count = (seen.get(chunk.chunkId) ?? 0) + 1;
    seen.set(chunk.chunkId, count);
    if (count > 1) {
      duplicates.add(chunk.chunkId);
    }
  }

  return [...duplicates].sort();
}

export function assertUniqueChunkIds(
  chunks: readonly { chunkId: string }[],
  corpusId: string,
): void {
  const duplicates = findDuplicateChunkIds(chunks);
  if (duplicates.length > 0) {
    throw new Error(
      `Duplicate chunkId(s) in ${corpusId}: ${duplicates.join(', ')}`,
    );
  }
}
