import type { E2E_JUDGE_CRITERIA } from './e2e-judge.constants.js';
import type {
  E2EEvaluationReport,
  E2EEvaluationRunMetadata,
  E2EQuestionResult,
} from './e2e-evaluation.types.js';

export interface E2EJudgeResult {
  questionId: string;
  correctness: number;
  completeness: number;
  groundedness: number;
  abstentionCorrect: boolean;
  explanation: string;
}

export interface E2EJudgeInput {
  questionId: string;
  question: string;
  referenceAnswer: string | null;
  generatedAnswer: string;
  context: string;
  expectedAbstention: boolean;
}

export interface E2EJudgeScoreSnapshot {
  correctness: number;
  completeness: number;
  groundedness: number;
  abstentionCorrect: boolean;
  explanation: string;
}

export interface E2EJudgeRawResponse {
  correctness: unknown;
  completeness: unknown;
  groundedness: unknown;
  abstentionCorrect: unknown;
  explanation: unknown;
}

export type E2EJudgeCriterion = (typeof E2E_JUDGE_CRITERIA)[number];

export interface E2EEvaluationMetadata {
  type: 'llm-as-a-judge';
  judgeModel: string;
  createdAt: string;
  criteria: E2EJudgeCriterion[];
}

export type E2EEvaluatedQuestionResult = E2EQuestionResult & {
  judge?: E2EJudgeScoreSnapshot;
};

export interface E2EEvaluatedReport {
  metadata: E2EEvaluationRunMetadata;
  evaluation: E2EEvaluationMetadata;
  results: E2EEvaluatedQuestionResult[];
}

export interface E2EJudgeSummary {
  questionCount: number;
  evaluatedCount: number;
  errorCount: number;
  outputPath: string;
}

export interface LoadE2EEvaluationResultsOptions {
  expectedQuestionCount?: number;
}

export type E2EEvaluationResultsReport = E2EEvaluationReport;
