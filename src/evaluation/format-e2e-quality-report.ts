import type {
  E2EQualityReport,
  E2EQualityReportSummary,
} from './e2e-report.types.js';

function formatPercent(value: number): string {
  if (Number.isInteger(value)) {
    return `${value}%`;
  }

  return `${value.toFixed(2)}%`;
}

function formatProblematicQuestionLine(
  question: E2EQualityReport['problematicQuestions'][number],
): string {
  if (question.expectedAbstention) {
    return `${question.questionId} — abstention incorrecte`;
  }

  const issues: string[] = [];
  if (
    question.correctness !== undefined &&
    question.correctness < 3
  ) {
    issues.push(`correctness=${question.correctness}`);
  }
  if (
    question.completeness !== undefined &&
    question.completeness < 3
  ) {
    issues.push(`completeness=${question.completeness}`);
  }
  if (
    question.groundedness !== undefined &&
    question.groundedness < 3
  ) {
    issues.push(`groundedness=${question.groundedness}`);
  }

  return `${question.questionId} — ${issues.join(', ')}`;
}

export function formatE2EQualityReport(report: E2EQualityReport): string {
  const problematicLines =
    report.problematicQuestions.length === 0
      ? ['(none)']
      : report.problematicQuestions.map(formatProblematicQuestionLine);

  return [
    'E2E EVALUATION REPORT',
    '=====================',
    '',
    `Questions: ${report.metadata.questionCount}`,
    `Normal: ${report.normalQuestions.count}`,
    `Abstention: ${report.abstentionQuestions.count}`,
    '',
    'NORMAL QUESTIONS',
    '----------------',
    'Correctness:',
    `  Average: ${report.normalQuestions.averageCorrectness.toFixed(2)} / 4`,
    `  Score >= 3: ${formatPercent(report.normalQuestions.correctnessPassRate)}`,
    '',
    'Completeness:',
    `  Average: ${report.normalQuestions.averageCompleteness.toFixed(2)} / 4`,
    `  Score >= 3: ${formatPercent(report.normalQuestions.completenessPassRate)}`,
    '',
    'Groundedness:',
    `  Average: ${report.normalQuestions.averageGroundedness.toFixed(2)} / 4`,
    `  Score >= 3: ${formatPercent(report.normalQuestions.groundednessPassRate)}`,
    '',
    'ABSTENTION',
    '----------',
    `Correct: ${report.abstentionQuestions.abstentionCorrectCount} / ${report.abstentionQuestions.count}`,
    `Accuracy: ${formatPercent(report.abstentionQuestions.abstentionAccuracy)}`,
    '',
    'PIPELINE',
    '--------',
    `Average latency: ${report.latency.all.averageTotalLatencyMs.toFixed(0)} ms`,
    `Average context: ${report.latency.all.averageContextCharacters.toFixed(0)} chars`,
    `Average filtered chunks: ${report.latency.all.averageFilteredContextChunks.toFixed(2)}`,
    '',
    'PROBLEMATIC QUESTIONS',
    '---------------------',
    ...problematicLines,
  ].join('\n');
}

export function summarizeE2EQualityReport(
  report: E2EQualityReport,
  outputPath: string,
): E2EQualityReportSummary {
  return {
    questionCount: report.metadata.questionCount,
    normalQuestionCount: report.normalQuestions.count,
    abstentionQuestionCount: report.abstentionQuestions.count,
    problematicQuestionCount: report.problematicQuestions.length,
    outputPath,
  };
}

export function formatE2EQualityReportCli(
  report: E2EQualityReport,
  outputPath: string,
): string {
  return `${formatE2EQualityReport(report)}\n\nOutput:\n${outputPath}`;
}
