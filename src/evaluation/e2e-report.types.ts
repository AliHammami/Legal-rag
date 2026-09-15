export type ScoreDistributionKey = '0' | '1' | '2' | '3' | '4';

export interface ScoreDistribution {
  '0': number;
  '1': number;
  '2': number;
  '3': number;
  '4': number;
}

export interface E2EQualityReportMetadata {
  dataset: string;
  questionCount: number;
  evaluatedAt: string;
  judgeModel: string;
}

export interface E2ENormalQuestionsSummary {
  count: number;
  averageCorrectness: number;
  averageCompleteness: number;
  averageGroundedness: number;
  correctnessPassRate: number;
  completenessPassRate: number;
  groundednessPassRate: number;
  correctnessDistribution: ScoreDistribution;
  completenessDistribution: ScoreDistribution;
  groundednessDistribution: ScoreDistribution;
}

export interface E2EAbstentionQuestionsSummary {
  count: number;
  abstentionCorrectCount: number;
  abstentionIncorrectCount: number;
  abstentionAccuracy: number;
  failedQuestionIds: string[];
}

export interface E2ELatencyBreakdown {
  averageTotalLatencyMs: number;
  averageContextCharacters: number;
  averageFilteredContextChunks: number;
}

export interface E2ELatencySummary {
  all: E2ELatencyBreakdown;
  normalQuestions: E2ELatencyBreakdown;
  abstentionQuestions: E2ELatencyBreakdown;
}

export interface E2EProblematicQuestion {
  questionId: string;
  question: string;
  expectedAbstention: boolean;
  correctness?: number;
  completeness?: number;
  groundedness?: number;
  abstentionCorrect?: boolean;
  explanation: string;
}

export interface E2EQualityReport {
  metadata: E2EQualityReportMetadata;
  normalQuestions: E2ENormalQuestionsSummary;
  abstentionQuestions: E2EAbstentionQuestionsSummary;
  latency: E2ELatencySummary;
  problematicQuestions: E2EProblematicQuestion[];
}

export interface E2EQualityReportSummary {
  questionCount: number;
  normalQuestionCount: number;
  abstentionQuestionCount: number;
  problematicQuestionCount: number;
  outputPath: string;
}
