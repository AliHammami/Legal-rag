import type { ContextFilteringSummary } from '../generation/types.js';
import type { PipelineProfilingTimings } from '../profiling/pipeline-timings.js';
import type { RerankStatus } from '../reranking/types.js';
import type { E2EEvaluationQuestion } from './types.js';

export interface E2EChunkSnapshot {
  rank: number;
  chunkId: string;
  articleNumber: string;
  distance?: number;
  score?: number;
  relativeScore?: number;
}

export interface E2ESourceSnapshot {
  sourceId: number;
  chunkId: string;
  articleNumber: string;
  chunkIndex: number;
}

export interface E2ETimingsSnapshot {
  embeddingMs: number;
  vectorSearchMs: number;
  jinaRerankingMs: number;
  mappingMs: number;
  retrievalTotalMs: number;
  contextFilteringMs: number;
  contextBuilderMs: number;
  generationMs: number;
  answerPipelineTotalMs: number;
}

export interface E2EQuestionResultBase {
  id: string;
  question: string;
  expectedAbstention: boolean;
  goldArticles: string[];
  referenceAnswer: string | null;
}

export interface E2EQuestionResultSuccess extends E2EQuestionResultBase {
  status: 'success';
  generatedAnswer: string;
  context: string;
  retrievedChunks: E2EChunkSnapshot[];
  rerankedChunks: E2EChunkSnapshot[];
  filteredContextChunks: E2EChunkSnapshot[];
  contextFiltering: ContextFilteringSummary;
  sources: E2ESourceSnapshot[];
  timings: E2ETimingsSnapshot;
  rerankStatus: RerankStatus;
}

export interface E2EQuestionErrorSnapshot {
  message: string;
  code: string;
}

export interface E2EQuestionResultError extends E2EQuestionResultBase {
  status: 'error';
  error: E2EQuestionErrorSnapshot;
}

export type E2EQuestionResult =
  | E2EQuestionResultSuccess
  | E2EQuestionResultError;

export interface E2EEvaluationRunMetadata {
  dataset: string;
  questionCount: number;
  generationModel: string;
  embeddingModel: string;
  rerankerModel: string;
  contextThreshold: number;
  createdAt: string;
}

export interface E2EEvaluationReport {
  metadata: E2EEvaluationRunMetadata;
  results: E2EQuestionResult[];
}

export interface E2EEvaluationSummary {
  questionCount: number;
  successCount: number;
  errorCount: number;
  normalQuestionCount: number;
  abstentionQuestionCount: number;
  averageContextCharacters: number;
  averageFilteredContextChunks: number;
  averageTotalLatencyMs: number;
  outputPath: string;
}

export interface BuildE2EQuestionResultInput {
  question: E2EEvaluationQuestion;
  pipelineResult: {
    answer: string;
    context: string;
    candidates: Array<{
      chunkId: string;
      articleNumber: string;
      distance: number;
      rerankScore?: number;
    }>;
    reranked: Array<{
      chunkId: string;
      articleNumber: string;
      distance: number;
      rerankScore?: number;
    }>;
    rerankStatus: RerankStatus;
    contextFiltering: ContextFilteringSummary;
    sources: Array<{
      sourceId: number;
      chunkId: string;
      articleNumber: string;
      chunkIndex: number;
      chunk: {
        chunkId: string;
        articleNumber: string;
        distance: number;
        rerankScore?: number;
      };
    }>;
    profiling: PipelineProfilingTimings;
  };
}
