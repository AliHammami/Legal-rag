import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { NestFactory } from '@nestjs/core';

import { DEFAULT_MULTICORPUS_EVALUATION_DATASET_PATH } from '../src/evaluation/constants.js';
import { loadMulticorpusEvaluationDataset } from '../src/evaluation/load-multicorpus-dataset.js';
import type { GenerationForensicRecord } from '../src/evaluation/multicorpus/generation-forensic-audit.js';
import { EMBEDDING_DIMENSIONS } from '../src/embeddings/constants.js';
import { OpenAIService } from '../src/openai/openai.service.js';
import { RetrievalPipelineModule } from '../src/retrieval/retrieval-pipeline.module.js';

const E2E_RUN_ID = '2026-09-21T16-59-10-310Z';
const GEN_FORENSIC_DIR = join(
  'reports/evaluation/runs',
  'generation-forensic-audit-2026-09-21',
);

/**
 * One-shot helper: exports question embeddings for the cohort A (61).
 * Requires OpenAI embedding API (not used by audit:retrieval-depth-e2e500).
 */
async function main(): Promise<void> {
  if (process.env.RETRIEVAL_DEPTH_CONFIRM_EMBEDDING_EXPORT !== '1') {
    throw new Error(
      'Set RETRIEVAL_DEPTH_CONFIRM_EMBEDDING_EXPORT=1 to export embeddings (calls OpenAI once per question).',
    );
  }

  const genForensic = JSON.parse(
    await readFile(join(GEN_FORENSIC_DIR, 'audit.json'), 'utf-8'),
  ) as { records: GenerationForensicRecord[] };

  const cohort = genForensic.records.filter(
    (record) => record.forensicCategory === 'A' && record.questionId !== 'q372',
  );
  const questions = await loadMulticorpusEvaluationDataset(
    DEFAULT_MULTICORPUS_EVALUATION_DATASET_PATH,
  );
  const questionById = new Map(questions.map((question) => [question.id, question]));

  const app = await NestFactory.createApplicationContext(RetrievalPipelineModule, {
    logger: ['error', 'warn'],
  });

  try {
    const openAIService = app.get(OpenAIService);
    const embeddings: Record<string, number[]> = {};

    for (const record of cohort) {
      const question = questionById.get(record.questionId);
      if (!question) {
        throw new Error(`Missing dataset question ${record.questionId}`);
      }
      const result = await openAIService.createEmbeddings([question.question]);
      const vector = result[0]?.embedding;
      if (!vector) {
        throw new Error(`Missing embedding for ${record.questionId}`);
      }
      embeddings[record.questionId] = vector;
      console.log(`Embedded ${record.questionId} (${Object.keys(embeddings).length}/${cohort.length})`);
    }

    const outputPath = join(
      'reports/evaluation/runs',
      E2E_RUN_ID,
      'question-embeddings-cache.json',
    );
    await mkdir(join('reports/evaluation/runs', E2E_RUN_ID), { recursive: true });
    await writeFile(
      outputPath,
      `${JSON.stringify(
        {
          metadata: {
            embeddingModel: openAIService.getEmbeddingModel(),
            dimensions: EMBEDDING_DIMENSIONS,
            source: 'export-retrieval-depth-embedding-cache-e2e500.ts',
            cohort: 'generation-forensic A (61)',
          },
          embeddings,
        },
        null,
        2,
      )}\n`,
    );
    console.log(`Wrote ${outputPath}`);
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
