import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { E2E_JUDGE_CRITERIA } from './e2e-judge.constants.js';
import type {
  E2EEvaluatedQuestionResult,
  E2EEvaluatedReport,
  E2EJudgeInput,
  E2EJudgeResult,
  E2EJudgeSummary,
} from './e2e-judge.types.js';
import type { E2EEvaluationReport } from './e2e-evaluation.types.js';
import { assertE2EResultJudgeable } from './load-e2e-evaluation-results.js';

export interface RunE2EJudgeDeps {
  judgeQuestion: (input: E2EJudgeInput) => Promise<E2EJudgeResult>;
  judgeModel: string;
  createdAt: string;
}

function toJudgeInput(
  result: Extract<E2EEvaluationReport['results'][number], { status: 'success' }>,
): E2EJudgeInput {
  return {
    questionId: result.id,
    question: result.question,
    referenceAnswer: result.referenceAnswer,
    generatedAnswer: result.generatedAnswer,
    context: result.context,
    expectedAbstention: result.expectedAbstention,
  };
}

export async function runE2EJudge(
  report: E2EEvaluationReport,
  deps: RunE2EJudgeDeps,
): Promise<E2EEvaluatedReport> {
  const evaluatedResults: E2EEvaluatedQuestionResult[] = [];

  for (const result of report.results) {
    assertE2EResultJudgeable(result);

    const judgeResult = await deps.judgeQuestion(toJudgeInput(result));

    evaluatedResults.push({
      ...result,
      judge: {
        correctness: judgeResult.correctness,
        completeness: judgeResult.completeness,
        groundedness: judgeResult.groundedness,
        abstentionCorrect: judgeResult.abstentionCorrect,
        explanation: judgeResult.explanation,
      },
    });
  }

  return {
    metadata: report.metadata,
    evaluation: {
      type: 'llm-as-a-judge',
      judgeModel: deps.judgeModel,
      createdAt: deps.createdAt,
      criteria: [...E2E_JUDGE_CRITERIA],
    },
    results: evaluatedResults,
  };
}

export async function writeE2EEvaluatedReport(
  outputPath: string,
  report: E2EEvaluatedReport,
): Promise<void> {
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf-8');
}

export function summarizeE2EJudgeReport(
  report: E2EEvaluatedReport,
  outputPath: string,
): E2EJudgeSummary {
  const evaluatedCount = report.results.filter((result) => result.judge).length;

  return {
    questionCount: report.results.length,
    evaluatedCount,
    errorCount: report.results.length - evaluatedCount,
    outputPath,
  };
}

export function formatE2EJudgeSummary(summary: E2EJudgeSummary): string {
  return [
    'E2E LLM JUDGE',
    '=============',
    '',
    `Questions: ${summary.questionCount}`,
    `Evaluated: ${summary.evaluatedCount}`,
    `Errors: ${summary.errorCount}`,
    '',
    'Output:',
    summary.outputPath,
  ].join('\n');
}
