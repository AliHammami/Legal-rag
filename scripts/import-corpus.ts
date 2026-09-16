import { access } from 'node:fs/promises';
import { resolve } from 'node:path';

import { NestFactory } from '@nestjs/core';

import { ALL_CORPUS_IDS } from '../src/ingestion/corpus-config.js';
import { corpusEmbeddingsPath } from '../src/persistence/constants.js';
import { importCorpusEmbeddings } from '../src/persistence/import-corpus-embeddings.js';
import { ImportPipelineModule } from '../src/persistence/import-pipeline.module.js';
import { validatePersistence } from '../src/persistence/validate-persistence.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const startedAt = Date.now();
const target = process.argv[2];

async function main(): Promise<void> {
  if (!target) {
    throw new Error('Usage: pnpm import:corpus <corpusId|all>');
  }

  const app = await NestFactory.createApplicationContext(ImportPipelineModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const prisma = app.get(PrismaService);
    const corpusIds =
      target === 'all' ? ALL_CORPUS_IDS : [target];

    for (const corpusId of corpusIds) {
      const embeddingsPath = resolve(corpusEmbeddingsPath(corpusId));
      try {
        await access(embeddingsPath);
      } catch {
        console.log(
          `[${corpusId}] Ignor\u00E9 : fichier embeddings absent (${embeddingsPath})`,
        );
        continue;
      }

      const result = await importCorpusEmbeddings(prisma, corpusId);

      console.log(
        `[${corpusId}] Import termin\u00E9 : ${result.verification.totalRows} chunks (${result.stats.batchCount} batches)`,
      );
      console.log(`[${corpusId}] Mod\u00E8le : ${result.source.embeddingModel}`);
      console.log(
        `[${corpusId}] Dimensions OK : ${result.verification.rowsWithEmbeddings - result.verification.invalidDimensionRows}/${result.verification.rowsWithEmbeddings} \u00E0 3072`,
      );
      console.log(
        `[${corpusId}] Doublons (corpusId, chunkId) : ${result.verification.duplicateCorpusChunkIds}`,
      );
    }

    const validation = await validatePersistence(prisma, corpusIds);
    console.log('');
    console.log('Validation persistance');
    console.log(`Total rows : ${validation.global.totalRows}`);
    console.log(`Total embeddings : ${validation.global.totalEmbeddings}`);
    console.log(
      `Doublons globaux (corpusId, chunkId) : ${validation.global.duplicateCorpusChunkIds}`,
    );
    console.log(`Dur\u00E9e : ${Date.now() - startedAt} ms`);
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error('');
  console.error('\u274C ERREUR FATALE');
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
