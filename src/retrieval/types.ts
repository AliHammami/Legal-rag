import type { PenalCodeChunkMetadata } from '../chunking/types.js';
import type { PipelineProfilingTimings } from '../profiling/pipeline-timings.js';

export interface SimilarChunk {
  corpusId: string;
  chunkId: string;
  articleNumber: string;
  content: string;
  metadata: PenalCodeChunkMetadata;
  distance: number;
}

export interface SearchSimilarChunksOptions {
  expectedDimensions?: number;
  /** Absent = all corpora; one or more = filtered search with global topK. */
  corpusIds?: string[];
}

export interface SearchQuestionOptions extends SearchSimilarChunksOptions {
  profiling?: PipelineProfilingTimings;
}

export interface SimilarChunkRow {
  corpus_id: string;
  chunk_id: string;
  article_number: string;
  content: string;
  metadata: unknown;
  distance: number | string;
}
