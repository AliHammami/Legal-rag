import { buildE2EQualityReport } from './build-e2e-quality-report.js';
import { buildE2ESourceReport } from './build-e2e-source-report.js';
import { EvaluationError } from './evaluation.error.js';
import type { E2EEvaluatedReport } from './e2e-judge.types.js';
import type { E2EQualityReport } from './e2e-report.types.js';
import type { E2ESourceReport } from './e2e-source-report.types.js';
import type { E2ESourcesEvaluatedReport } from './e2e-source-judge.types.js';

function numbersEqual(left: number, right: number, tolerance = 0.01): boolean {
  return Math.abs(left - right) <= tolerance;
}

export function verifyQualityReportConsistency(
  evaluatedReport: E2EEvaluatedReport,
  storedReport: E2EQualityReport,
): void {
  const recomputed = buildE2EQualityReport(evaluatedReport);

  const comparisons: Array<[string, number, number]> = [
    [
      'normalQuestions.count',
      recomputed.normalQuestions.count,
      storedReport.normalQuestions.count,
    ],
    [
      'averageCorrectness',
      recomputed.normalQuestions.averageCorrectness,
      storedReport.normalQuestions.averageCorrectness,
    ],
    [
      'averageCompleteness',
      recomputed.normalQuestions.averageCompleteness,
      storedReport.normalQuestions.averageCompleteness,
    ],
    [
      'averageGroundedness',
      recomputed.normalQuestions.averageGroundedness,
      storedReport.normalQuestions.averageGroundedness,
    ],
    [
      'correctnessPassRate',
      recomputed.normalQuestions.correctnessPassRate,
      storedReport.normalQuestions.correctnessPassRate,
    ],
    [
      'completenessPassRate',
      recomputed.normalQuestions.completenessPassRate,
      storedReport.normalQuestions.completenessPassRate,
    ],
    [
      'groundednessPassRate',
      recomputed.normalQuestions.groundednessPassRate,
      storedReport.normalQuestions.groundednessPassRate,
    ],
    [
      'abstentionAccuracy',
      recomputed.abstentionQuestions.abstentionAccuracy,
      storedReport.abstentionQuestions.abstentionAccuracy,
    ],
    [
      'averageTotalLatencyMs',
      recomputed.latency.all.averageTotalLatencyMs,
      storedReport.latency.all.averageTotalLatencyMs,
    ],
    [
      'averageContextCharacters',
      recomputed.latency.all.averageContextCharacters,
      storedReport.latency.all.averageContextCharacters,
    ],
    [
      'averageFilteredContextChunks',
      recomputed.latency.all.averageFilteredContextChunks,
      storedReport.latency.all.averageFilteredContextChunks,
    ],
  ];

  for (const [label, left, right] of comparisons) {
    if (!numbersEqual(left, right)) {
      throw new EvaluationError(
        `Quality report mismatch on ${label}: stored=${right}, recomputed=${left}`,
        'VALIDATION_FAILED',
      );
    }
  }

  if (
    JSON.stringify(recomputed.problematicQuestions.map((item) => item.questionId)) !==
    JSON.stringify(storedReport.problematicQuestions.map((item) => item.questionId))
  ) {
    throw new EvaluationError(
      'Quality report problematicQuestions mismatch',
      'VALIDATION_FAILED',
    );
  }
}

export function verifySourceReportConsistency(
  sourcesEvaluatedReport: E2ESourcesEvaluatedReport,
  storedReport: E2ESourceReport,
  sourceFile: string,
): void {
  const recomputed = buildE2ESourceReport(sourcesEvaluatedReport, sourceFile);
  const comparisons: Array<[string, number, number]> = [
    [
      'averageSourceRelevance',
      recomputed.summary.averageSourceRelevance,
      storedReport.summary.averageSourceRelevance,
    ],
    [
      'averageSourceCoverage',
      recomputed.summary.averageSourceCoverage,
      storedReport.summary.averageSourceCoverage,
    ],
    [
      'sourceRelevancePassRate',
      recomputed.summary.sourceRelevancePassRate,
      storedReport.summary.sourceRelevancePassRate,
    ],
    [
      'sourceCoveragePassRate',
      recomputed.summary.sourceCoveragePassRate,
      storedReport.summary.sourceCoveragePassRate,
    ],
  ];

  for (const [label, left, right] of comparisons) {
    if (!numbersEqual(left, right)) {
      throw new EvaluationError(
        `Source report mismatch on ${label}: stored=${right}, recomputed=${left}`,
        'VALIDATION_FAILED',
      );
    }
  }

  if (
    JSON.stringify(recomputed.summary.lowSourceRelevanceQuestionIds) !==
    JSON.stringify(storedReport.summary.lowSourceRelevanceQuestionIds)
  ) {
    throw new EvaluationError(
      'Source report lowSourceRelevanceQuestionIds mismatch',
      'VALIDATION_FAILED',
    );
  }

  if (
    JSON.stringify(recomputed.summary.lowSourceCoverageQuestionIds) !==
    JSON.stringify(storedReport.summary.lowSourceCoverageQuestionIds)
  ) {
    throw new EvaluationError(
      'Source report lowSourceCoverageQuestionIds mismatch',
      'VALIDATION_FAILED',
    );
  }
}
