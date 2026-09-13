import { NestFactory } from '@nestjs/core';

import { importCodePenal } from '../src/persistence/import-code-penal.js';
import { ImportPipelineModule } from '../src/persistence/import-pipeline.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const startedAt = Date.now();

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(ImportPipelineModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const prisma = app.get(PrismaService);
    const result = await importCodePenal(prisma);

    console.log(
      `Import terminé : ${result.verification.totalRows} chunks (${result.stats.batchCount} batches)`,
    );
    console.log(`Modèle : ${result.source.embeddingModel}`);
    console.log(
      `Dimensions OK : ${result.verification.totalRows - result.verification.invalidDimensionRows}/${result.verification.totalRows} à 3072`,
    );
    console.log(`Doublons chunkId : ${result.verification.duplicateChunkIds}`);
    console.log(`Durée : ${Date.now() - startedAt} ms`);
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
