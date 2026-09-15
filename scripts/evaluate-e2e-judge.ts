import { NestFactory } from '@nestjs/core';

import {
  DEFAULT_E2E_EVALUATED_RESULTS_PATH,
  DEFAULT_E2E_EVALUATION_RESULTS_PATH,
} from '../src/evaluation/constants.js';
import { E2EJudgeModule } from '../src/evaluation/e2e-judge.module.js';
import { E2EJudgeService } from '../src/evaluation/e2e-judge.service.js';
import { loadE2EEvaluationResults } from '../src/evaluation/load-e2e-evaluation-results.js';
import {
  formatE2EJudgeSummary,
  runE2EJudge,
  summarizeE2EJudgeReport,
  writeE2EEvaluatedReport,
} from '../src/evaluation/run-e2e-judge.js';

async function main(): Promise<void> {
  const resultsReport = await loadE2EEvaluationResults(
    DEFAULT_E2E_EVALUATION_RESULTS_PATH,
  );

  const app = await NestFactory.createApplicationContext(E2EJudgeModule, {
    logger: ['error', 'warn'],
  });

  try {
    const judgeService = app.get(E2EJudgeService);

    const evaluatedReport = await runE2EJudge(resultsReport, {
      judgeQuestion: (input) => judgeService.judgeQuestion(input),
      judgeModel: judgeService.getJudgeModel(),
      createdAt: new Date().toISOString(),
    });

    await writeE2EEvaluatedReport(
      DEFAULT_E2E_EVALUATED_RESULTS_PATH,
      evaluatedReport,
    );

    const summary = summarizeE2EJudgeReport(
      evaluatedReport,
      DEFAULT_E2E_EVALUATED_RESULTS_PATH,
    );
    console.log(formatE2EJudgeSummary(summary));

    if (summary.errorCount > 0) {
      process.exitCode = 1;
    }
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error('');
  console.error('❌ ERREUR FATALE');
  console.error('');

  if (error instanceof Error) {
    console.error(`Nom : ${error.name}`);
    console.error(`Message : ${error.message}`);
    console.error('');
    console.error('Stack :');
    console.error(error.stack);
  } else {
    console.error(error);
  }

  process.exitCode = 1;
});
