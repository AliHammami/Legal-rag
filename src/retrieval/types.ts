import type { PenalCodeChunkMetadata } from '../chunking/types.js';

export interface SimilarChunk {
  chunkId: string;
  articleNumber: string;
  content: string;
  metadata: PenalCodeChunkMetadata;
  distance: number;
}

export interface SearchSimilarChunksOptions {
  expectedDimensions?: number;
}

export type SearchQuestionOptions = SearchSimilarChunksOptions;

export interface SimilarChunkRow {
  chunk_id: string;
  article_number: string;
  content: string;
  metadata: unknown;
  distance: number | string;
}
