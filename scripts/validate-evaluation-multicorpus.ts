import {
  DEFAULT_MULTICORPUS_EVALUATION_DATASET_PATH,
} from '../src/evaluation/constants.js';
import { loadMulticorpusCorpusArticleRegistry } from '../src/evaluation/load-corpus-article-index.js';
import { loadMulticorpusEvaluationDataset } from '../src/evaluation/load-multicorpus-dataset.js';
import { formatMulticorpusDatasetValidationReport } from '../src/evaluation/report-multicorpus-dataset.js';
import {
  assertValidMulticorpusEvaluationDataset,
  validateMulticorpusEvaluationDataset,
} from '../src/evaluation/validate-multicorpus-dataset.js';

async function main(): Promise<void> {
  const questions = await loadMulticorpusEvaluationDataset(
    DEFAULT_MULTICORPUS_EVALUATION_DATASET_PATH,
  );
  const registry = await loadMulticorpusCorpusArticleRegistry();
  const summary = validateMulticorpusEvaluationDataset(questions, registry);

  console.log(formatMulticorpusDatasetValidationReport(summary));
  assertValidMulticorpusEvaluationDataset(summary);
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
