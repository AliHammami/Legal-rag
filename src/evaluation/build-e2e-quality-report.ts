import type { E2EEvaluatedReport } from './e2e-judge.types.js';
import type {
  E2EAbstentionQuestionsSummary,
  E2ELatencyBreakdown,
  E2ELatencySummary,
  E2ENormalQuestionsSummary,
  E2EProblematicQuestion,
  E2EQualityReport,
} from './e2e-report.types.js';
import { EvaluationError } from './evaluation.error.js';
import {
  computeAccuracy,
  computeAverage,
  computePassRate,
  JUDGE_PASS_SCORE_THRESHOLD,
  roundToTwoDecimals,
} from './report-metrics.js';
import { buildScoreDistribution } from './score-distribution.js';
import { average } from './metrics.js';

type EvaluatedSuccessResult = Extract<
  E2EEvaluatedReport['results'][number],
  { status: 'success' }
>;

function assertHasJudge(
  result: EvaluatedSuccessResult,
): asserts result is EvaluatedSuccessResult & {
  judge: NonNullable<EvaluatedSuccessResult['judge']>;
} {
  if (!result.judge) {
    throw new EvaluationError(
      `Evaluated E2E result ${result.id} is missing judge scores`,
      'EVALUATED_RESULTS_INVALID',
    );
  }
}

function splitResultsByAbstention(results: EvaluatedSuccessResult[]): {
  normalResults: EvaluatedSuccessResult[];
  abstentionResults: EvaluatedSuccessResult[];
} {
  const normalResults: EvaluatedSuccessResult[] = [];
  const abstentionResults: EvaluatedSuccessResult[] = [];

  for (const result of results) {
    assertHasJudge(result);

    if (result.expectedAbstention) {
      abstentionResults.push(result);
    } else {
      normalResults.push(result);
    }
  }

  return { normalResults, abstentionResults };
}

function buildNormalQuestionsSummary(
  normalResults: EvaluatedSuccessResult[],
): E2ENormalQuestionsSummary {
  if (normalResults.length === 0) {
    throw new EvaluationError(
      'Cannot build normal question summary: no normal questions found',
      'REPORT_EMPTY_DATASET',
    );
  }

  const correctnessScores = normalResults.map((result) => result.judge!.correctness);
  const completenessScores = normalResults.map((result) => result.judge!.completeness);
  const groundednessScores = normalResults.map((result) => result.judge!.groundedness);

  return {
    count: normalResults.length,
    averageCorrectness: computeAverage(correctnessScores),
    averageCompleteness: computeAverage(completenessScores),
    averageGroundedness: computeAverage(groundednessScores),
    correctnessPassRate: computePassRate(correctnessScores),
    completenessPassRate: computePassRate(completenessScores),
    groundednessPassRate: computePassRate(groundednessScores),
    correctnessDistribution: buildScoreDistribution(correctnessScores),
    completenessDistribution: buildScoreDistribution(completenessScores),
    groundednessDistribution: buildScoreDistribution(groundednessScores),
  };
}

function buildAbstentionQuestionsSummary(
  abstentionResults: EvaluatedSuccessResult[],
): E2EAbstentionQuestionsSummary {
  if (abstentionResults.length === 0) {
    throw new EvaluationError(
      'Cannot build abstention summary: no abstention questions found',
      'REPORT_EMPTY_DATASET',
    );
  }

  const abstentionCorrectCount = abstentionResults.filter(
    (result) => result.judge!.abstentionCorrect,
  ).length;
  const abstentionIncorrectCount =
    abstentionResults.length - abstentionCorrectCount;
  const failedQuestionIds = abstentionResults
    .filter((result) => !result.judge!.abstentionCorrect)
    .map((result) => result.id);

  return {
    count: abstentionResults.length,
    abstentionCorrectCount,
    abstentionIncorrectCount,
    abstentionAccuracy: computeAccuracy(
      abstentionCorrectCount,
      abstentionResults.length,
    ),
    failedQuestionIds,
  };
}

function buildLatencyBreakdown(
  results: EvaluatedSuccessResult[],
): E2ELatencyBreakdown {
  if (results.length === 0) {
    throw new EvaluationError(
      'Cannot build latency summary on an empty result set',
      'REPORT_EMPTY_DATASET',
    );
  }

  return {
    averageTotalLatencyMs: roundToTwoDecimals(
      average(results.map((result) => result.timings.answerPipelineTotalMs)),
    ),
    averageContextCharacters: roundToTwoDecimals(
      average(results.map((result) => result.context.length)),
    ),
    averageFilteredContextChunks: roundToTwoDecimals(
      average(results.map((result) => result.filteredContextChunks.length)),
    ),
  };
}

function buildLatencySummary(
  allResults: EvaluatedSuccessResult[],
  normalResults: EvaluatedSuccessResult[],
  abstentionResults: EvaluatedSuccessResult[],
): E2ELatencySummary {
  return {
    all: buildLatencyBreakdown(allResults),
    normalQuestions: buildLatencyBreakdown(normalResults),
    abstentionQuestions: buildLatencyBreakdown(abstentionResults),
  };
}

function isProblematicNormalQuestion(result: EvaluatedSuccessResult): boolean {
  const judge = result.judge!;

  return (
    judge.correctness < JUDGE_PASS_SCORE_THRESHOLD ||
    judge.completeness < JUDGE_PASS_SCORE_THRESHOLD ||
    judge.groundedness < JUDGE_PASS_SCORE_THRESHOLD
  );
}

function isProblematicAbstentionQuestion(result: EvaluatedSuccessResult): boolean {
  return !result.judge!.abstentionCorrect;
}

function toProblematicQuestion(
  result: EvaluatedSuccessResult,
): E2EProblematicQuestion {
  const judge = result.judge!;

  if (result.expectedAbstention) {
    return {
      questionId: result.id,
      question: result.question,
      expectedAbstention: true,
      groundedness: judge.groundedness,
      abstentionCorrect: judge.abstentionCorrect,
      explanation: judge.explanation,
    };
  }

  return {
    questionId: result.id,
    question: result.question,
    expectedAbstention: false,
    correctness: judge.correctness,
    completeness: judge.completeness,
    groundedness: judge.groundedness,
    explanation: judge.explanation,
  };
}

function buildProblematicQuestions(
  normalResults: EvaluatedSuccessResult[],
  abstentionResults: EvaluatedSuccessResult[],
): E2EProblematicQuestion[] {
  const problematicQuestions: E2EProblematicQuestion[] = [];

  for (const result of normalResults) {
    if (isProblematicNormalQuestion(result)) {
      problematicQuestions.push(toProblematicQuestion(result));
    }
  }

  for (const result of abstentionResults) {
    if (isProblematicAbstentionQuestion(result)) {
      problematicQuestions.push(toProblematicQuestion(result));
    }
  }

  return problematicQuestions.sort((left, right) =>
    left.questionId.localeCompare(right.questionId),
  );
}

export function buildE2EQualityReport(
  evaluatedReport: E2EEvaluatedReport,
): E2EQualityReport {
  if (evaluatedReport.results.length === 0) {
    throw new EvaluationError(
      'Cannot build E2E quality report from an empty evaluated dataset',
      'REPORT_EMPTY_DATASET',
    );
  }

  const successResults = evaluatedReport.results as EvaluatedSuccessResult[];
  const { normalResults, abstentionResults } =
    splitResultsByAbstention(successResults);

  return {
    metadata: {
      dataset: evaluatedReport.metadata.dataset,
      questionCount: evaluatedReport.results.length,
      evaluatedAt: evaluatedReport.evaluation.createdAt,
      judgeModel: evaluatedReport.evaluation.judgeModel,
    },
    normalQuestions: buildNormalQuestionsSummary(normalResults),
    abstentionQuestions: buildAbstentionQuestionsSummary(abstentionResults),
    latency: buildLatencySummary(
      successResults,
      normalResults,
      abstentionResults,
    ),
    problematicQuestions: buildProblematicQuestions(
      normalResults,
      abstentionResults,
    ),
  };
}
