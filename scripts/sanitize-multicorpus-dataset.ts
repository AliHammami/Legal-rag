import { writeFile } from 'node:fs/promises';

import { DEFAULT_MULTICORPUS_EVALUATION_DATASET_PATH } from '../src/evaluation/constants.js';
import { loadMulticorpusEvaluationDataset } from '../src/evaluation/load-multicorpus-dataset.js';
import { sanitizeMulticorpusDataset } from '../src/evaluation/sanitize-multicorpus-dataset.js';

async function main(): Promise<void> {
  const questions = await loadMulticorpusEvaluationDataset(
    DEFAULT_MULTICORPUS_EVALUATION_DATASET_PATH,
  );
  const sanitized = sanitizeMulticorpusDataset(questions);

  await writeFile(
    DEFAULT_MULTICORPUS_EVALUATION_DATASET_PATH,
    `${JSON.stringify(sanitized, null, 2)}\n`,
    'utf-8',
  );

  console.log(`Sanitized ${sanitized.length} questions`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
