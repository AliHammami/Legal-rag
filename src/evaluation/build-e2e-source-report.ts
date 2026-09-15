import type { E2ESourceReport } from './e2e-source-report.types.js';
import type { E2ESourcesEvaluatedReport } from './e2e-source-judge.types.js';
import { EvaluationError } from './evaluation.error.js';
import {
  computeAverage,
  computePassRate,
  JUDGE_PASS_SCORE_THRESHOLD,
} from './report-metrics.js';
import { buildScoreDistribution } from './score-distribution.js';

type EvaluatedSuccessResult = Extract<
  E2ESourcesEvaluatedReport['results'][number],
  { status: 'success' }
>;

function assertHasSourceJudge(
  result: EvaluatedSuccessResult,
): asserts result is EvaluatedSuccessResult & {
  sourceJudge: NonNullable<EvaluatedSuccessResult['sourceJudge']>;
} {
  if (!result.sourceJudge) {
    throw new EvaluationError(
      `Missing sourceJudge for question ${result.id}`,
      'SOURCE_EVALUATED_RESULTS_INVALID',
    );
  }
}

export function buildE2ESourceReport(
  report: E2ESourcesEvaluatedReport,
  sourceFile: string,
): E2ESourceReport {
  if (report.results.length === 0) {
    throw new EvaluationError(
      'Cannot build source report from an empty dataset',
      'REPORT_EMPTY_DATASET',
    );
  }

  const successResults = report.results as EvaluatedSuccessResult[];
  const judgedResults: Array<
    EvaluatedSuccessResult & {
      sourceJudge: NonNullable<EvaluatedSuccessResult['sourceJudge']>;
    }
  > = [];

  for (const result of successResults) {
    assertHasSourceJudge(result);
    judgedResults.push(result);
  }

  const relevanceScores = judgedResults.map(
    (result) => result.sourceJudge.sourceRelevance,
  );
  const coverageScores = judgedResults.map(
    (result) => result.sourceJudge.sourceCoverage,
  );

  const lowSourceRelevanceQuestionIds = judgedResults
    .filter(
      (result) =>
        result.sourceJudge.sourceRelevance < JUDGE_PASS_SCORE_THRESHOLD,
    )
    .map((result) => result.id)
    .sort();

  const lowSourceCoverageQuestionIds = judgedResults
    .filter(
      (result) =>
        result.sourceJudge.sourceCoverage < JUDGE_PASS_SCORE_THRESHOLD,
    )
    .map((result) => result.id)
    .sort();

  return {
    metadata: {
      sourceFile,
      questionCount: judgedResults.length,
      evaluatedAt: report.sourceEvaluation.createdAt,
      judgeModel: report.sourceEvaluation.judgeModel,
    },
    summary: {
      averageSourceRelevance: computeAverage(relevanceScores),
      averageSourceCoverage: computeAverage(coverageScores),
      sourceRelevancePassRate: computePassRate(relevanceScores),
      sourceCoveragePassRate: computePassRate(coverageScores),
      sourceRelevanceDistribution: buildScoreDistribution(relevanceScores),
      sourceCoverageDistribution: buildScoreDistribution(coverageScores),
      lowSourceRelevanceQuestionIds,
      lowSourceCoverageQuestionIds,
    },
  };
}
