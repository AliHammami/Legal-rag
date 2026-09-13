import type { PenalCodeChunk } from '../chunking/types.js';

export function buildBatches(
  chunks: PenalCodeChunk[],
  batchSize: number,
): PenalCodeChunk[][] {
  if (batchSize <= 0) {
    throw new Error('batchSize must be greater than 0');
  }

  const batches: PenalCodeChunk[][] = [];
  for (let i = 0; i < chunks.length; i += batchSize) {
    batches.push(chunks.slice(i, i + batchSize));
  }
  return batches;
}
