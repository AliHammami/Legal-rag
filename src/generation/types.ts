import type { PipelineProfilingTimings } from '../profiling/pipeline-timings.js';
import type { RoutingMetadata } from '../routing/types.js';
import type { SimilarChunk } from '../retrieval/types.js';
import type { RerankStatus, RerankedChunk } from '../reranking/types.js';

export interface ContextSource {
  sourceId: number;
  chunkId: string;
  articleNumber: string;
  chunkIndex: number;
  content: string;
  chunk: RerankedChunk;
}

export interface BuiltRagContext {
  context: string;
  sources: ContextSource[];
}

export interface ContextFilteringSummary {
  jinaResults: number;
  contextResults: number;
  relativeScoreThreshold: number;
}

export interface AnswerQuestionResult {
  question: string;
  routing?: RoutingMetadata;
  candidates: SimilarChunk[];
  reranked: RerankedChunk[];
  rerankStatus: RerankStatus;
  contextFiltering: ContextFilteringSummary;
  context: string;
  sources: ContextSource[];
  answer: string;
  profiling: PipelineProfilingTimings;
}
