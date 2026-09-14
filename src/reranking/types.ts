import type { SimilarChunk } from '../retrieval/types.js';

export interface RankedChunkItem {
  chunkId: string;
}

export interface RerankModelResponse {
  rankedChunks: RankedChunkItem[];
}

export type RerankedChunk = SimilarChunk;
