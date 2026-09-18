import { DEFAULT_MULTICORPUS_EVALUATION_DATASET_PATH } from '../src/evaluation/constants.js';
import { loadMulticorpusEvaluationDataset } from '../src/evaluation/load-multicorpus-dataset.js';
import {
  buildMulticorpusDatasetReport,
  formatMulticorpusDatasetReport,
} from '../src/evaluation/report-multicorpus-dataset.js';

async function main(): Promise<void> {
  const questions = await loadMulticorpusEvaluationDataset(
    DEFAULT_MULTICORPUS_EVALUATION_DATASET_PATH,
  );
  const report = buildMulticorpusDatasetReport(questions);
  console.log(formatMulticorpusDatasetReport(report));
}

main().catch((error: unknown) => {
  console.error('');
  console.error('? ERREUR FATALE');
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
