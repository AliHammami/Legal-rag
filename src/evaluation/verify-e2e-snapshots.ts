import type { E2EEvaluationReport } from './e2e-evaluation.types.js';
import type { E2EEvaluatedReport } from './e2e-judge.types.js';
import type { E2ESourcesEvaluatedReport } from './e2e-source-judge.types.js';
import { EvaluationError } from './evaluation.error.js';
import { isValidJudgeScore } from './parse-e2e-judge-response.js';
import { parseE2EJudgeScoreSnapshot } from './parse-e2e-judge-response.js';
import { isValidSourceJudgeScore } from './parse-e2e-source-judge-response.js';

export const EXPECTED_E2E_QUESTION_COUNT = 25;
export const EXPECTED_E2E_NORMAL_QUESTION_COUNT = 20;
export const EXPECTED_E2E_ABSTENTION_QUESTION_COUNT = 5;

export interface E2ESnapshotVerification {
  questionCount: number;
  successCount: number;
  errorCount: number;
  normalQuestionCount: number;
  abstentionQuestionCount: number;
}

function countAbstention(results: Array<{ expectedAbstention: boolean }>): {
  normalQuestionCount: number;
  abstentionQuestionCount: number;
} {
  const abstentionQuestionCount = results.filter(
    (result) => result.expectedAbstention,
  ).length;

  return {
    normalQuestionCount: results.length - abstentionQuestionCount,
    abstentionQuestionCount,
  };
}

export function verifyE2EResultsSnapshot(
  report: E2EEvaluationReport,
): E2ESnapshotVerification {
  if (report.results.length !== EXPECTED_E2E_QUESTION_COUNT) {
    throw new EvaluationError(
      `E2E results expected ${EXPECTED_E2E_QUESTION_COUNT} questions, got ${report.results.length}`,
      'VALIDATION_FAILED',
    );
  }

  if (report.metadata.questionCount !== EXPECTED_E2E_QUESTION_COUNT) {
    throw new EvaluationError(
      'E2E results metadata.questionCount mismatch',
      'VALIDATION_FAILED',
    );
  }

  const requiredMetadata = [
    'generationModel',
    'embeddingModel',
    'rerankerModel',
    'contextThreshold',
    'createdAt',
  ] as const;

  for (const field of requiredMetadata) {
    if (
      report.metadata[field] === undefined ||
      report.metadata[field] === null ||
      report.metadata[field] === ''
    ) {
      throw new EvaluationError(
        `E2E results metadata.${field} is missing`,
        'VALIDATION_FAILED',
      );
    }
  }

  let successCount = 0;
  let errorCount = 0;

  for (const result of report.results) {
    if (result.status === 'success') {
      successCount += 1;

      if (!result.generatedAnswer?.trim()) {
        throw new EvaluationError(
          `E2E result ${result.id} missing generatedAnswer`,
          'VALIDATION_FAILED',
        );
      }

      if (!result.context?.trim()) {
        throw new EvaluationError(
          `E2E result ${result.id} missing context`,
          'VALIDATION_FAILED',
        );
      }

      if (!Array.isArray(result.sources)) {
        throw new EvaluationError(
          `E2E result ${result.id} missing sources`,
          'VALIDATION_FAILED',
        );
      }

      if (result.timings?.answerPipelineTotalMs === undefined) {
        throw new EvaluationError(
          `E2E result ${result.id} missing timings`,
          'VALIDATION_FAILED',
        );
      }
    } else {
      errorCount += 1;
    }
  }

  const counts = countAbstention(report.results);

  if (counts.normalQuestionCount !== EXPECTED_E2E_NORMAL_QUESTION_COUNT) {
    throw new EvaluationError(
      `E2E results expected ${EXPECTED_E2E_NORMAL_QUESTION_COUNT} normal questions, got ${counts.normalQuestionCount}`,
      'VALIDATION_FAILED',
    );
  }

  if (counts.abstentionQuestionCount !== EXPECTED_E2E_ABSTENTION_QUESTION_COUNT) {
    throw new EvaluationError(
      `E2E results expected ${EXPECTED_E2E_ABSTENTION_QUESTION_COUNT} abstention questions, got ${counts.abstentionQuestionCount}`,
      'VALIDATION_FAILED',
    );
  }

  return {
    questionCount: report.results.length,
    successCount,
    errorCount,
    ...counts,
  };
}

export function verifyE2EEvaluatedSnapshot(
  report: E2EEvaluatedReport,
): E2ESnapshotVerification {
  const base = verifyE2EResultsSnapshot(report);

  if (report.evaluation.type !== 'llm-as-a-judge') {
    throw new EvaluationError(
      'Evaluated E2E file missing llm-as-a-judge evaluation block',
      'VALIDATION_FAILED',
    );
  }

  for (const result of report.results) {
    if (result.status !== 'success') {
      throw new EvaluationError(
        `Evaluated E2E result ${result.id} is not success`,
        'VALIDATION_FAILED',
      );
    }

    parseE2EJudgeScoreSnapshot(result.judge, result.id);

    const judge = result.judge!;
    for (const field of ['correctness', 'completeness', 'groundedness'] as const) {
      if (!isValidJudgeScore(judge[field])) {
        throw new EvaluationError(
          `Invalid judge ${field} for ${result.id}`,
          'VALIDATION_FAILED',
        );
      }
    }

    if (typeof judge.abstentionCorrect !== 'boolean') {
      throw new EvaluationError(
        `Invalid judge abstentionCorrect for ${result.id}`,
        'VALIDATION_FAILED',
      );
    }

    if (!judge.explanation?.trim()) {
      throw new EvaluationError(
        `Missing judge explanation for ${result.id}`,
        'VALIDATION_FAILED',
      );
    }
  }

  if (base.errorCount > 0) {
    throw new EvaluationError(
      `Evaluated E2E results contain ${base.errorCount} pipeline errors`,
      'VALIDATION_FAILED',
    );
  }

  return base;
}

export function verifyE2ESourcesEvaluatedSnapshot(
  report: E2ESourcesEvaluatedReport,
): E2ESnapshotVerification {
  verifyE2EEvaluatedSnapshot(report);

  if (report.sourceEvaluation.type !== 'llm-as-a-judge-sources') {
    throw new EvaluationError(
      'Sources evaluated file missing source evaluation block',
      'VALIDATION_FAILED',
    );
  }

  for (const result of report.results) {
    if (!result.sourceJudge) {
      throw new EvaluationError(
        `Missing sourceJudge for ${result.id}`,
        'VALIDATION_FAILED',
      );
    }

    if (!isValidSourceJudgeScore(result.sourceJudge.sourceRelevance)) {
      throw new EvaluationError(
        `Invalid sourceRelevance for ${result.id}`,
        'VALIDATION_FAILED',
      );
    }

    if (!isValidSourceJudgeScore(result.sourceJudge.sourceCoverage)) {
      throw new EvaluationError(
        `Invalid sourceCoverage for ${result.id}`,
        'VALIDATION_FAILED',
      );
    }

    if (!result.sourceJudge.explanation?.trim()) {
      throw new EvaluationError(
        `Missing source judge explanation for ${result.id}`,
        'VALIDATION_FAILED',
      );
    }
  }

  const counts = countAbstention(report.results);

  return {
    questionCount: report.results.length,
    successCount: report.results.length,
    errorCount: 0,
    ...counts,
  };
}
