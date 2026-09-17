import { access } from 'node:fs/promises';

import { NestFactory } from '@nestjs/core';

import { generateCorpusEmbeddings } from '../src/embeddings/generate-corpus-embeddings.js';
import { corpusChunksPath } from '../src/embeddings/corpus-paths.js';
import { EmbeddingPipelineModule } from '../src/embeddings/embedding-pipeline.module.js';
import { ALL_CORPUS_IDS } from '../src/ingestion/corpus-config.js';
import { OpenAIService } from '../src/openai/openai.service.js';

const startedAt = Date.now();
const target = process.argv[2];

async function main(): Promise<void> {
  if (!target) {
    throw new Error('Usage: pnpm embed:corpus <corpusId|all>');
  }

  const app = await NestFactory.createApplicationContext(EmbeddingPipelineModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const openAIService = app.get(OpenAIService);
    const corpusIds = target === 'all' ? ALL_CORPUS_IDS : [target];

    console.log(`Mod\u00E8le embedding : ${openAIService.getEmbeddingModel()}`);

    for (const corpusId of corpusIds) {
      const chunksPath = corpusChunksPath(corpusId);
      try {
        await access(chunksPath);
      } catch {
        console.log(`[${corpusId}] Ignor\u00E9 : fichier chunks absent (${chunksPath})`);
        continue;
      }

      console.log(`[${corpusId}] G\u00E9n\u00E9ration des embeddings...`);
      const result = await generateCorpusEmbeddings(openAIService, corpusId);

      console.log(
        `[${corpusId}] Termin\u00E9 : ${result.stats.outputRecordCount} records (${result.stats.batchCount} batches)`,
      );
      console.log(`[${corpusId}] Dimensions : ${result.config.dimensions}`);
      console.log(
        `[${corpusId}] Sortie : data/processed/${corpusId}.embeddings.json`,
      );
    }

    console.log(`Dur\u00E9e totale : ${Date.now() - startedAt} ms`);
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
