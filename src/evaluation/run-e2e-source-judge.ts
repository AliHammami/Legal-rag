import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { extractE2ESourcesFromContext } from './extract-e2e-sources-from-context.js';
import type {
  E2ESourceJudgeInput,
  E2ESourceJudgeResult,
  E2ESourceJudgeSummary,
  E2ESourcesEvaluatedQuestionResult,
  E2ESourcesEvaluatedReport,
} from './e2e-source-judge.types.js';
import type { E2EEvaluatedReport } from './e2e-judge.types.js';
import { assertE2EResultJudgeable } from './load-e2e-evaluation-results.js';

export interface RunE2ESourceJudgeDeps {
  judgeSources: (input: E2ESourceJudgeInput) => Promise<E2ESourceJudgeResult>;
  judgeModel: string;
  createdAt: string;
}

function toSourceJudgeInput(
  result: Extract<E2EEvaluatedReport['results'][number], { status: 'success' }>,
): E2ESourceJudgeInput {
  return {
    questionId: result.id,
    question: result.question,
    referenceAnswer: result.referenceAnswer,
    generatedAnswer: result.generatedAnswer,
    expectedAbstention: result.expectedAbstention,
    sources: extractE2ESourcesFromContext(
      result.context,
      result.sources,
      result.id,
    ),
    judgeResult: result.judge ?? null,
  };
}

export async function runE2ESourceJudge(
  report: E2EEvaluatedReport,
  deps: RunE2ESourceJudgeDeps,
): Promise<E2ESourcesEvaluatedReport> {
  const evaluatedResults: E2ESourcesEvaluatedQuestionResult[] = [];

  for (const result of report.results) {
    assertE2EResultJudgeable(result);

    const sourceJudgeResult = await deps.judgeSources(toSourceJudgeInput(result));

    evaluatedResults.push({
      ...result,
      sourceJudge: sourceJudgeResult,
    });
  }

  return {
    metadata: report.metadata,
    evaluation: report.evaluation,
    sourceEvaluation: {
      type: 'llm-as-a-judge-sources',
      judgeModel: deps.judgeModel,
      createdAt: deps.createdAt,
    },
    results: evaluatedResults,
  };
}

export async function writeE2ESourcesEvaluatedReport(
  outputPath: string,
  report: E2ESourcesEvaluatedReport,
): Promise<void> {
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf-8');
}

export function summarizeE2ESourceJudgeReport(
  report: E2ESourcesEvaluatedReport,
  outputPath: string,
  reportPath: string,
): E2ESourceJudgeSummary {
  const evaluatedCount = report.results.filter(
    (result) => result.sourceJudge,
  ).length;

  return {
    questionCount: report.results.length,
    evaluatedCount,
    errorCount: report.results.length - evaluatedCount,
    outputPath,
    reportPath,
  };
}

export function formatE2ESourceJudgeSummary(
  summary: E2ESourceJudgeSummary,
  reportSummary: {
    averageSourceRelevance: number;
    averageSourceCoverage: number;
    sourceRelevancePassRate: number;
    sourceCoveragePassRate: number;
    lowSourceRelevanceQuestionIds: string[];
    lowSourceCoverageQuestionIds: string[];
  },
): string {
  return [
    'E2E SOURCE JUDGE',
    '================',
    '',
    `Questions: ${summary.questionCount}`,
    `Evaluated: ${summary.evaluatedCount}`,
    `Errors: ${summary.errorCount}`,
    '',
    `Average sourceRelevance: ${reportSummary.averageSourceRelevance.toFixed(2)} / 4`,
    `Average sourceCoverage: ${reportSummary.averageSourceCoverage.toFixed(2)} / 4`,
    `sourceRelevance >= 3: ${reportSummary.sourceRelevancePassRate}%`,
    `sourceCoverage >= 3: ${reportSummary.sourceCoveragePassRate}%`,
    '',
    'Low sourceRelevance:',
    reportSummary.lowSourceRelevanceQuestionIds.length > 0
      ? reportSummary.lowSourceRelevanceQuestionIds.join(', ')
      : '(none)',
    '',
    'Low sourceCoverage:',
    reportSummary.lowSourceCoverageQuestionIds.length > 0
      ? reportSummary.lowSourceCoverageQuestionIds.join(', ')
      : '(none)',
    '',
    'Output:',
    summary.outputPath,
    '',
    'Report:',
    summary.reportPath,
  ].join('\n');
}
