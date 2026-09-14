import type { SimilarChunk } from '../retrieval/types.js';

export type RerankDocument = {
  chunkId: string;
  content: string;
};

export type RerankResult = {
  chunkId: string;
  score: number;
};

export type RerankedChunk = SimilarChunk & {
  rerankScore?: number;
};

export type RerankStatus = 'success' | 'fallback';
