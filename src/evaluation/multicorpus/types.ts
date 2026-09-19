import type { GoldArticle } from '../gold-article.js';
import type {
  LegalMulticorpusEvaluationQuestion,
  MulticorpusDifficulty,
  MulticorpusQuestionType,
} from '../multicorpus-dataset.types.js';
import type { PipelineProfilingTimings } from '../../profiling/pipeline-timings.js';

export type FailureStage =
  | 'routing'
  | 'retrieval'
  | 'reranking'
  | 'generation'
  | 'abstention'
  | 'none';

export type EvaluationMode = 'routing' | 'retrieval' | 'reranking' | 'e2e';

export interface MulticorpusModelConfiguration {
  embeddingModel: string;
  rerankerModel: string;
  generationModel: string;
  routingModel: string;
  judgeModel?: string;
  retrievalTopK: number;
  rerankTopK: number;
  relativeScoreThreshold: number;
  routingEnabled: boolean;
}

export interface MulticorpusRunMetadata {
  datasetVersion: string;
  datasetPath: string;
  timestamp: string;
  evaluatorVersion: string;
  modelConfiguration: MulticorpusModelConfiguration;
  evaluationConcurrency: number;
  jinaConcurrency: number;
  questionCount: number;
  limit?: number;
}

export interface RoutingQuestionResult {
  questionId: string;
  questionType: MulticorpusQuestionType;
  difficulty: MulticorpusDifficulty;
  goldCorpusIds: string[];
  predictedCorpusIds: string[];
  exactMatch: boolean;
  precision: number;
  recall: number;
  f1: number;
  latencyMs: number;
  fallbackToGlobal: boolean;
}

export interface RetrievalMetricsSnapshot {
  recallAt5: number;
  recallAt10: number;
  recallAt20: number;
  mrr: number;
}

export interface RetrievalQuestionResult {
  questionId: string;
  questionType: MulticorpusQuestionType;
  difficulty: MulticorpusDifficulty;
  goldArticles: GoldArticle[];
  global: RetrievalMetricsSnapshot;
  routed: RetrievalMetricsSnapshot;
  latencyMs: {
    global: number;
    routed: number;
  };
}

export interface RerankingQuestionResult {
  questionId: string;
  questionType: MulticorpusQuestionType;
  difficulty: MulticorpusDifficulty;
  goldArticles: GoldArticle[];
  vectorTop5: RetrievalMetricsSnapshot;
  jinaTop5: RetrievalMetricsSnapshot;
  rerankEffect: 'improved' | 'degraded' | 'unchanged';
  latencyMs: number;
}

export interface E2EVariantResult {
  answer: string;
  sources: GoldArticle[];
  profiling: PipelineProfilingTimings;
  judge?: {
    correctness: number;
    completeness: number;
    groundedness: number;
    abstentionCorrect: boolean;
    explanation: string;
  };
  sourceJudge?: {
    sourceRelevance: number;
    sourceCoverage: number;
    explanation: string;
  };
}

export interface E2EQuestionResult {
  questionId: string;
  questionType: MulticorpusQuestionType;
  difficulty: MulticorpusDifficulty;
  expectedAbstention: boolean;
  baseline: E2EVariantResult;
  routing: E2EVariantResult;
  failureStage: FailureStage;
}

export interface MetricBreakdownRow {
  label: string;
  count: number;
  metrics: Record<string, number>;
}

export interface MulticorpusEvaluationReports {
  metadata: MulticorpusRunMetadata;
  routing?: {
    summary: Record<string, number>;
    breakdown: MetricBreakdownRow[];
    results: RoutingQuestionResult[];
  };
  retrieval?: {
    summary: {
      global: RetrievalMetricsSnapshot;
      routed: RetrievalMetricsSnapshot;
    };
    breakdown: MetricBreakdownRow[];
    results: RetrievalQuestionResult[];
  };
  reranking?: {
    summary: {
      vectorTop5: RetrievalMetricsSnapshot;
      jinaTop5: RetrievalMetricsSnapshot;
      improved: number;
      degraded: number;
      unchanged: number;
    };
    breakdown: MetricBreakdownRow[];
    results: RerankingQuestionResult[];
  };
  e2e?: {
    summary: Record<string, Record<string, number>>;
    rerankFallbacks: number;
    rerankPipelineRuns: number;
    latency: Record<string, { average: number; p50: number; p95: number }>;
    breakdown: MetricBreakdownRow[];
    results: E2EQuestionResult[];
  };
  errors?: {
    byStage: Record<FailureStage, number>;
    results: Array<{ questionId: string; failureStage: FailureStage }>;
  };
}

export interface MulticorpusEvaluationQuestionContext {
  question: LegalMulticorpusEvaluationQuestion;
  expectedAbstention: boolean;
}
