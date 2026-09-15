import type { E2EEvaluatedReport } from './e2e-judge.types.js';
import type {
  E2EAnalysisFile,
  E2EAnalysisFilteredContextChunk,
  E2EAnalysisQuestion,
} from './e2e-analysis.types.js';
import { EvaluationError } from './evaluation.error.js';
import {
  computeAverage,
  JUDGE_PASS_SCORE_THRESHOLD,
} from './report-metrics.js';

type EvaluatedSuccessResult = Extract<
  E2EEvaluatedReport['results'][number],
  { status: 'success' }
>;

function toFilteredContextChunks(
  chunks: EvaluatedSuccessResult['filteredContextChunks'],
): E2EAnalysisFilteredContextChunk[] {
  return chunks.map((chunk) => ({
    chunkId: chunk.chunkId,
    articleNumber: chunk.articleNumber,
    ...(chunk.score !== undefined ? { rerankScore: chunk.score } : {}),
  }));
}

function isProblematicQuestion(result: EvaluatedSuccessResult): boolean {
  const judge = result.judge!;

  if (result.expectedAbstention) {
    return !judge.abstentionCorrect;
  }

  return (
    judge.correctness < JUDGE_PASS_SCORE_THRESHOLD ||
    judge.completeness < JUDGE_PASS_SCORE_THRESHOLD ||
    judge.groundedness < JUDGE_PASS_SCORE_THRESHOLD
  );
}

function toAnalysisQuestion(
  result: EvaluatedSuccessResult,
): E2EAnalysisQuestion {
  if (!result.judge) {
    throw new EvaluationError(
      `Cannot build analysis for question ${result.id}: judge block is required`,
      'EVALUATED_RESULTS_INVALID',
    );
  }

  return {
    id: result.id,
    question: result.question,
    expectedAbstention: result.expectedAbstention,
    goldArticles: result.goldArticles,
    filteredContextChunks: toFilteredContextChunks(result.filteredContextChunks),
    generatedAnswer: result.generatedAnswer,
    judge: {
      correctness: result.judge.correctness,
      completeness: result.judge.completeness,
      groundedness: result.judge.groundedness,
      abstentionCorrect: result.judge.abstentionCorrect,
      explanation: result.judge.explanation,
    },
  };
}

export function buildE2EAnalysis(
  evaluatedReport: E2EEvaluatedReport,
): E2EAnalysisFile {
  if (evaluatedReport.results.length === 0) {
    throw new EvaluationError(
      'Cannot build E2E analysis from an empty evaluated dataset',
      'REPORT_EMPTY_DATASET',
    );
  }

  const successResults = evaluatedReport.results.filter(
    (result): result is EvaluatedSuccessResult => result.status === 'success',
  );

  if (successResults.length !== evaluatedReport.results.length) {
    throw new EvaluationError(
      'E2E analysis requires only successful pipeline results',
      'EVALUATED_RESULTS_INVALID',
    );
  }

  const normalResults = successResults.filter(
    (result) => !result.expectedAbstention,
  );
  const abstentionResults = successResults.filter(
    (result) => result.expectedAbstention,
  );

  if (normalResults.length === 0) {
    throw new EvaluationError(
      'Cannot build E2E analysis: no normal questions found',
      'REPORT_EMPTY_DATASET',
    );
  }

  const questions = successResults.map(toAnalysisQuestion);
  const problematicQuestionIds = successResults
    .filter(isProblematicQuestion)
    .map((result) => result.id)
    .sort();

  return {
    summary: {
      totalQuestions: successResults.length,
      normalQuestions: normalResults.length,
      abstentionQuestions: abstentionResults.length,
      averageCorrectness: computeAverage(
        normalResults.map((result) => result.judge!.correctness),
      ),
      averageCompleteness: computeAverage(
        normalResults.map((result) => result.judge!.completeness),
      ),
      averageGroundedness: computeAverage(
        normalResults.map((result) => result.judge!.groundedness),
      ),
      problematicQuestionIds,
    },
    questions,
  };
}
