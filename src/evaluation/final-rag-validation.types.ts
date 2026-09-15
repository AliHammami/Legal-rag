import type { E2EDatasetValidationSummary } from './types.js';
import type { EvaluationSummary } from './types.js';

export type ValidationCheckStatus = 'pass' | 'fail' | 'skip';

export interface ValidationCheck {
  status: ValidationCheckStatus;
  reason?: string;
}

export interface FinalRagValidationProject {
  tests: ValidationCheck;
  build: ValidationCheck;
}

export interface FinalRagValidationDatasets {
  retrievalDataset: ValidationCheck;
  e2eDataset: ValidationCheck;
  e2eDatasetSummary?: E2EDatasetValidationSummary;
}

export interface FinalRagValidationPipeline {
  ingestion: ValidationCheck;
  chunking: ValidationCheck;
  embeddings: ValidationCheck;
  postgresqlPgvector: ValidationCheck;
  retrieval: ValidationCheck;
  jinaReranking: ValidationCheck;
  dynamicContextFiltering: ValidationCheck;
  generation: ValidationCheck;
}

export interface FinalRagValidationRetrieval {
  status: ValidationCheck;
  metrics?: EvaluationSummary;
}

export interface FinalRagValidationE2E {
  snapshot: ValidationCheck;
  judge: ValidationCheck;
  qualityReport: ValidationCheck;
  metrics?: {
    questionCount: number;
    normalQuestions: number;
    abstentionQuestions: number;
    averageCorrectness: number;
    averageCompleteness: number;
    averageGroundedness: number;
    correctnessPassRate: number;
    completenessPassRate: number;
    groundednessPassRate: number;
    abstentionAccuracy: number;
    problematicQuestionCount: number;
    averageTotalLatencyMs: number;
    averageContextCharacters: number;
    averageFilteredContextChunks: number;
  };
}

export interface FinalRagValidationSources {
  snapshot: ValidationCheck;
  report: ValidationCheck;
  metrics?: {
    averageSourceRelevance: number;
    averageSourceCoverage: number;
    sourceRelevancePassRate: number;
    sourceCoveragePassRate: number;
    lowSourceRelevanceQuestionIds: string[];
    lowSourceCoverageQuestionIds: string[];
  };
}

export interface FinalRagValidationArtifacts {
  e2eResults: ValidationCheck;
  e2eEvaluated: ValidationCheck;
  e2eQualityReport: ValidationCheck;
  sourcesEvaluated: ValidationCheck;
  sourceReport: ValidationCheck;
}

export interface FinalRagValidationLimitations {
  benchmarkSpecificMetrics: ValidationCheck;
  sameModelJudgeBias: ValidationCheck;
  contextThreshold40Percent: ValidationCheck;
  smallCorpusNoHnsw: ValidationCheck;
  jinaNoGlobalMetricGain: ValidationCheck;
}

export interface FinalRagValidationReport {
  timestamp: string;
  project: FinalRagValidationProject;
  datasets: FinalRagValidationDatasets;
  pipeline: FinalRagValidationPipeline;
  retrieval: FinalRagValidationRetrieval;
  e2e: FinalRagValidationE2E;
  sources: FinalRagValidationSources;
  artifacts: FinalRagValidationArtifacts;
  limitations: FinalRagValidationLimitations;
  corpusChunkCount: number;
  status: 'PASS' | 'FAIL';
  failures: string[];
}

export interface RunFinalRagValidationInput {
  testsPassed: boolean;
  buildPassed: boolean;
  retrievalMetrics?: EvaluationSummary;
  corpusChunkCount: number;
}
