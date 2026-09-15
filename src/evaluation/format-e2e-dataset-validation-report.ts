import type { E2EDatasetValidationSummary } from './types.js';

function formatStatus(isValid: boolean): string {
  return isValid ? 'valid' : 'invalid';
}

export function formatE2EDatasetValidationReport(
  summary: E2EDatasetValidationSummary,
): string {
  return [
    'E2E DATASET VALIDATION',
    '======================',
    '',
    `Questions: ${summary.questionCount}`,
    `Normal questions: ${summary.normalQuestionCount}`,
    `Abstention questions: ${summary.abstentionQuestionCount}`,
    '',
    `Gold articles: ${formatStatus(summary.invalidGoldArticles.length === 0)}`,
    `Reference answers: ${formatStatus(summary.invalidReferenceAnswers.length === 0)}`,
    `Duplicate IDs: ${summary.duplicateIds.length === 0 ? 'none' : summary.duplicateIds.join(', ')}`,
    '',
    `Dataset: ${summary.isValid ? 'VALID' : 'INVALID'}`,
  ].join('\n');
}
