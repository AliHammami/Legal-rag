import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { NestFactory } from '@nestjs/core';

import { buildE2ESourceReport } from '../src/evaluation/build-e2e-source-report.js';
import {
  DEFAULT_E2E_EVALUATED_RESULTS_PATH,
  DEFAULT_E2E_SOURCE_REPORT_PATH,
  DEFAULT_E2E_SOURCES_EVALUATED_PATH,
} from '../src/evaluation/constants.js';
import { E2ESourceJudgeModule } from '../src/evaluation/e2e-source-judge.module.js';
import { E2ESourceJudgeService } from '../src/evaluation/e2e-source-judge.service.js';
import { loadE2EEvaluatedReport } from '../src/evaluation/load-e2e-evaluated-report.js';
import {
  formatE2ESourceJudgeSummary,
  runE2ESourceJudge,
  summarizeE2ESourceJudgeReport,
  writeE2ESourcesEvaluatedReport,
} from '../src/evaluation/run-e2e-source-judge.js';

async function writeE2ESourceReport(
  outputPath: string,
  report: ReturnType<typeof buildE2ESourceReport>,
): Promise<void> {
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf-8');
}

async function main(): Promise<void> {
  const evaluatedReport = await loadE2EEvaluatedReport(
    DEFAULT_E2E_EVALUATED_RESULTS_PATH,
  );

  const app = await NestFactory.createApplicationContext(E2ESourceJudgeModule, {
    logger: ['error', 'warn'],
  });

  try {
    const sourceJudgeService = app.get(E2ESourceJudgeService);

    const sourcesEvaluatedReport = await runE2ESourceJudge(evaluatedReport, {
      judgeSources: (input) => sourceJudgeService.judgeSources(input),
      judgeModel: sourceJudgeService.getJudgeModel(),
      createdAt: new Date().toISOString(),
    });

    await writeE2ESourcesEvaluatedReport(
      DEFAULT_E2E_SOURCES_EVALUATED_PATH,
      sourcesEvaluatedReport,
    );

    const sourceReport = buildE2ESourceReport(
      sourcesEvaluatedReport,
      DEFAULT_E2E_EVALUATED_RESULTS_PATH,
    );

    await writeE2ESourceReport(
      DEFAULT_E2E_SOURCE_REPORT_PATH,
      sourceReport,
    );

    const summary = summarizeE2ESourceJudgeReport(
      sourcesEvaluatedReport,
      DEFAULT_E2E_SOURCES_EVALUATED_PATH,
      DEFAULT_E2E_SOURCE_REPORT_PATH,
    );

    console.log(
      formatE2ESourceJudgeSummary(summary, sourceReport.summary),
    );

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
