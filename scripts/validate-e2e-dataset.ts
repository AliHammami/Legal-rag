import {
  DEFAULT_CORPUS_ARTICLES_PATH,
  DEFAULT_E2E_EVALUATION_DATASET_PATH,
} from '../src/evaluation/constants.js';
import { formatE2EDatasetValidationReport } from '../src/evaluation/format-e2e-dataset-validation-report.js';
import { loadCorpusArticleNumbersFromArticlesFile } from '../src/evaluation/load-corpus-articles.js';
import { loadE2EEvaluationDataset } from '../src/evaluation/load-e2e-evaluation-dataset.js';
import {
  assertValidE2EEvaluationDataset,
  validateE2EEvaluationDataset,
} from '../src/evaluation/validate-e2e-dataset.js';

async function main(): Promise<void> {
  const questions = await loadE2EEvaluationDataset(
    DEFAULT_E2E_EVALUATION_DATASET_PATH,
  );
  const corpusArticleNumbers = await loadCorpusArticleNumbersFromArticlesFile(
    DEFAULT_CORPUS_ARTICLES_PATH,
  );
  const summary = validateE2EEvaluationDataset(
    questions,
    corpusArticleNumbers,
  );

  console.log(formatE2EDatasetValidationReport(summary));

  assertValidE2EEvaluationDataset(summary);
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
