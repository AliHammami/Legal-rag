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
      `Import termin\u00E9 : ${result.verification.totalRows} chunks (${result.stats.batchCount} batches)`,
    );
    console.log(`Mod\u00E8le : ${result.source.embeddingModel}`);
    console.log(
      `Dimensions OK : ${result.verification.rowsWithEmbeddings - result.verification.invalidDimensionRows}/${result.verification.rowsWithEmbeddings} \u00E0 3072`,
    );
    console.log(
      `Doublons (corpusId, chunkId) : ${result.verification.duplicateCorpusChunkIds}`,
    );
    console.log(`Supprim\u00E9s (obsol\u00E8tes) : ${result.stats.deletedCount}`);
    if (result.stats.deletedChunkIds.length > 0) {
      console.log(
        `chunkIds supprim\u00E9s : ${result.stats.deletedChunkIds.join(', ')}`,
      );
    }
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
