import type { E2EEvaluationRunMetadata } from './e2e-evaluation.types.js';
import type {
  E2EEvaluationMetadata,
  E2EEvaluatedQuestionResult,
  E2EJudgeScoreSnapshot,
} from './e2e-judge.types.js';

export type E2ESourceJudgeScore = 0 | 1 | 2 | 3 | 4;

export interface E2ESourceJudgeResult {
  sourceRelevance: E2ESourceJudgeScore;
  sourceCoverage: E2ESourceJudgeScore;
  explanation: string;
}

export interface E2ESourceJudgeSourceInput {
  sourceId: number;
  chunkId: string;
  articleNumber: string;
  content: string;
}

export interface E2ESourceJudgeInput {
  questionId: string;
  question: string;
  referenceAnswer: string | null;
  generatedAnswer: string;
  expectedAbstention: boolean;
  sources: E2ESourceJudgeSourceInput[];
  judgeResult: E2EJudgeScoreSnapshot | null;
}

export interface E2ESourceJudgeRawResponse {
  sourceRelevance: unknown;
  sourceCoverage: unknown;
  explanation: unknown;
}

export interface E2ESourceEvaluationMetadata {
  type: 'llm-as-a-judge-sources';
  judgeModel: string;
  createdAt: string;
}

export type E2ESourcesEvaluatedQuestionResult = E2EEvaluatedQuestionResult & {
  sourceJudge?: E2ESourceJudgeResult;
};

export interface E2ESourcesEvaluatedReport {
  metadata: E2EEvaluationRunMetadata;
  evaluation: E2EEvaluationMetadata;
  sourceEvaluation: E2ESourceEvaluationMetadata;
  results: E2ESourcesEvaluatedQuestionResult[];
}

export interface E2ESourceJudgeSummary {
  questionCount: number;
  evaluatedCount: number;
  errorCount: number;
  outputPath: string;
  reportPath: string;
}
