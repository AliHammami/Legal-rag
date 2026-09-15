import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { buildE2EAnalysis } from '../src/evaluation/build-e2e-analysis.js';
import {
  DEFAULT_E2E_ANALYSIS_PATH,
  DEFAULT_E2E_EVALUATED_RESULTS_PATH,
} from '../src/evaluation/constants.js';
import { loadE2EEvaluatedReport } from '../src/evaluation/load-e2e-evaluated-report.js';

async function main(): Promise<void> {
  const evaluatedReport = await loadE2EEvaluatedReport(
    DEFAULT_E2E_EVALUATED_RESULTS_PATH,
  );
  const analysis = buildE2EAnalysis(evaluatedReport);

  await mkdir(dirname(DEFAULT_E2E_ANALYSIS_PATH), { recursive: true });
  await writeFile(
    DEFAULT_E2E_ANALYSIS_PATH,
    `${JSON.stringify(analysis, null, 2)}\n`,
    'utf-8',
  );

  console.log(`Exported ${analysis.questions.length} questions`);
  console.log(DEFAULT_E2E_ANALYSIS_PATH);
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
