import type { PenalCodeChunkMetadata } from '../chunking/types.js';

export interface EmbeddingConfig {
  model: string;
  dimensions: number;
  batchSize: number;
}

export interface PenalCodeEmbeddedChunk {
  chunkId: string;
  articleNumber: string;
  content: string;
  charCount: number;
  embedding: number[];
  metadata: PenalCodeChunkMetadata;
}

export interface PenalCodeEmbeddingStats {
  inputChunkCount: number;
  outputRecordCount: number;
  batchCount: number;
  durationMs: number;
  missingChunks: number;
  duplicateChunkIds: number;
}

export interface PenalCodeEmbeddingResult {
  source: {
    chunksFile: string;
    chunksExtractedAt?: string;
    chunkCount: number;
  };
  embeddedAt: string;
  config: EmbeddingConfig;
  stats: PenalCodeEmbeddingStats;
  records: PenalCodeEmbeddedChunk[];
}
