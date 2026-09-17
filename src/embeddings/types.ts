import type { PenalCodeChunkMetadata } from '../chunking/types.js';

export interface EmbeddingConfig {
  model: string;
  dimensions: number;
  batchSize: number;
}

export interface CorpusEmbeddedChunk {
  corpusId: string;
  chunkId: string;
  articleNumber: string;
  content: string;
  charCount: number;
  embedding: number[];
  metadata: PenalCodeChunkMetadata;
}

/** @deprecated Use CorpusEmbeddedChunk */
export type PenalCodeEmbeddedChunk = CorpusEmbeddedChunk;

export interface PenalCodeEmbeddingStats {
  inputChunkCount: number;
  outputRecordCount: number;
  batchCount: number;
  durationMs: number;
  missingChunks: number;
  duplicateChunkIds: number;
}

export interface CorpusEmbeddingResult {
  corpusId: string;
  source: {
    corpusId: string;
    chunksFile: string;
    chunksExtractedAt?: string;
    chunkCount: number;
  };
  embeddedAt: string;
  config: EmbeddingConfig;
  stats: PenalCodeEmbeddingStats;
  records: CorpusEmbeddedChunk[];
}

/** @deprecated Use CorpusEmbeddingResult */
export type PenalCodeEmbeddingResult = CorpusEmbeddingResult;
