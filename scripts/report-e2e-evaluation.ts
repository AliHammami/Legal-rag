import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { buildE2EQualityReport } from '../src/evaluation/build-e2e-quality-report.js';
import {
  DEFAULT_E2E_EVALUATED_RESULTS_PATH,
  DEFAULT_E2E_QUALITY_REPORT_PATH,
} from '../src/evaluation/constants.js';
import { formatE2EQualityReportCli } from '../src/evaluation/format-e2e-quality-report.js';
import { loadE2EEvaluatedReport } from '../src/evaluation/load-e2e-evaluated-report.js';

async function writeE2EQualityReport(
  outputPath: string,
  report: ReturnType<typeof buildE2EQualityReport>,
): Promise<void> {
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf-8');
}

async function main(): Promise<void> {
  const evaluatedReport = await loadE2EEvaluatedReport(
    DEFAULT_E2E_EVALUATED_RESULTS_PATH,
  );
  const qualityReport = buildE2EQualityReport(evaluatedReport);

  await writeE2EQualityReport(
    DEFAULT_E2E_QUALITY_REPORT_PATH,
    qualityReport,
  );

  console.log(
    formatE2EQualityReportCli(
      qualityReport,
      DEFAULT_E2E_QUALITY_REPORT_PATH,
    ),
  );
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
