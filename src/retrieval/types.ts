import type { PenalCodeChunkMetadata } from '../chunking/types.js';
import type { PipelineProfilingTimings } from '../profiling/pipeline-timings.js';

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

export interface SearchQuestionOptions extends SearchSimilarChunksOptions {
  profiling?: PipelineProfilingTimings;
}

export interface SimilarChunkRow {
  chunk_id: string;
  article_number: string;
  content: string;
  metadata: unknown;
  distance: number | string;
}
