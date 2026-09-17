import type { PenalCodeChunkMetadata } from '../chunking/types.js';
import type { SimilarChunk, SimilarChunkRow } from './types.js';

function parseDistance(distance: number | string): number {
  const value = typeof distance === 'number' ? distance : Number(distance);
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid distance value: ${distance}`);
  }
  return value;
}

export function mapSearchResult(row: SimilarChunkRow): SimilarChunk {
  return {
    corpusId: row.corpus_id,
    chunkId: row.chunk_id,
    articleNumber: row.article_number,
    content: row.content,
    metadata: row.metadata as PenalCodeChunkMetadata,
    distance: parseDistance(row.distance),
  };
}

export function mapSearchResults(rows: SimilarChunkRow[]): SimilarChunk[] {
  return rows.map(mapSearchResult);
}
