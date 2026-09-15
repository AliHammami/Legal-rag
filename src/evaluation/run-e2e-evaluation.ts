import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { average } from './metrics.js';
import {
  buildE2EQuestionResultError,
  buildE2EQuestionResultFromAnswerQuestion,
} from './build-e2e-question-result.js';
import type {
  E2EEvaluationReport,
  E2EEvaluationRunMetadata,
  E2EEvaluationSummary,
  E2EQuestionResult,
} from './e2e-evaluation.types.js';
import type { E2EEvaluationQuestion } from './types.js';
import type { AnswerQuestionResult } from '../generation/types.js';

export interface RunE2EEvaluationDeps {
  answerQuestion: (
    question: E2EEvaluationQuestion,
  ) => Promise<AnswerQuestionResult>;
  metadata: E2EEvaluationRunMetadata;
}

export async function runE2EEvaluation(
  questions: E2EEvaluationQuestion[],
  deps: RunE2EEvaluationDeps,
): Promise<E2EEvaluationReport> {
  const results: E2EQuestionResult[] = [];

  for (const question of questions) {
    try {
      const pipelineResult = await deps.answerQuestion(question);
      results.push(
        buildE2EQuestionResultFromAnswerQuestion(question, pipelineResult),
      );
    } catch (error) {
      results.push(buildE2EQuestionResultError(question, error));
    }
  }

  return {
    metadata: {
      ...deps.metadata,
      questionCount: questions.length,
    },
    results,
  };
}

export async function writeE2EEvaluationReport(
  outputPath: string,
  report: E2EEvaluationReport,
): Promise<void> {
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf-8');
}

export function summarizeE2EEvaluationReport(
  report: E2EEvaluationReport,
  outputPath: string,
): E2EEvaluationSummary {
  const successResults = report.results.filter(
    (result): result is Extract<E2EQuestionResult, { status: 'success' }> =>
      result.status === 'success',
  );
  const normalQuestionCount = report.results.filter(
    (result) => !result.expectedAbstention,
  ).length;
  const abstentionQuestionCount = report.results.filter(
    (result) => result.expectedAbstention,
  ).length;

  return {
    questionCount: report.results.length,
    successCount: successResults.length,
    errorCount: report.results.length - successResults.length,
    normalQuestionCount,
    abstentionQuestionCount,
    averageContextCharacters: average(
      successResults.map((result) => result.context.length),
    ),
    averageFilteredContextChunks: average(
      successResults.map((result) => result.filteredContextChunks.length),
    ),
    averageTotalLatencyMs: average(
      successResults.map((result) => result.timings.answerPipelineTotalMs),
    ),
    outputPath,
  };
}

export function formatE2EEvaluationSummary(
  summary: E2EEvaluationSummary,
): string {
  return [
    'E2E EVALUATION',
    '==============',
    '',
    `Questions: ${summary.questionCount}`,
    `Success: ${summary.successCount}`,
    `Errors: ${summary.errorCount}`,
    '',
    `Normal: ${summary.normalQuestionCount}`,
    `Abstention: ${summary.abstentionQuestionCount}`,
    '',
    `Average context size: ${summary.averageContextCharacters.toFixed(0)} characters`,
    `Average filtered context chunks: ${summary.averageFilteredContextChunks.toFixed(2)}`,
    `Average total latency: ${summary.averageTotalLatencyMs.toFixed(0)} ms`,
    '',
    'Output:',
    summary.outputPath,
  ].join('\n');
}
