import type { PipelineProfilingTimings } from '../profiling/pipeline-timings.js';
import type { SimilarChunk } from '../retrieval/types.js';
import type { RerankStatus } from '../reranking/types.js';

export interface EvaluationQuestion {
  id: string;
  question: string;
  goldArticles: string[];
}

export interface QuestionEvaluationMetrics {
  recallAt20Vector: 0 | 1;
  recallAt5Vector: 0 | 1;
  recallAt5Jina: 0 | 1;
  mrrVector: number;
  mrrJina: number;
}

export interface QuestionEvaluationResult {
  question: EvaluationQuestion;
  vectorTop20: SimilarChunk[];
  vectorTop5: SimilarChunk[];
  jinaTop5: SimilarChunk[];
  rerankStatus: RerankStatus;
  metrics: QuestionEvaluationMetrics;
  profiling: PipelineProfilingTimings;
}

export interface EvaluationSummary {
  questionCount: number;
  recallAt20Vector: number;
  recallAt5Vector: number;
  recallAt5Jina: number;
  mrrVector: number;
  mrrJina: number;
  recallAt5ImprovementPoints: number;
  mrrImprovement: number;
  averageEmbeddingMs: number;
  averageVectorSearchMs: number;
  averageJinaRerankingMs: number;
  averageTotalMs: number;
}

export interface RetrievalEvaluationReport {
  results: QuestionEvaluationResult[];
  summary: EvaluationSummary;
}
