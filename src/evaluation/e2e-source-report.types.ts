import type { ScoreDistribution } from './e2e-report.types.js';

export interface E2ESourceReportMetadata {
  sourceFile: string;
  questionCount: number;
  evaluatedAt: string;
  judgeModel: string;
}

export interface E2ESourceReportSummary {
  averageSourceRelevance: number;
  averageSourceCoverage: number;
  sourceRelevancePassRate: number;
  sourceCoveragePassRate: number;
  sourceRelevanceDistribution: ScoreDistribution;
  sourceCoverageDistribution: ScoreDistribution;
  lowSourceRelevanceQuestionIds: string[];
  lowSourceCoverageQuestionIds: string[];
}

export interface E2ESourceReport {
  metadata: E2ESourceReportMetadata;
  summary: E2ESourceReportSummary;
}
