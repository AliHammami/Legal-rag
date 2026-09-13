import { NestFactory } from '@nestjs/core';

import { embedCodePenal } from '../src/embeddings/embed-code-penal.js';
import { EmbeddingPipelineModule } from '../src/embeddings/embedding-pipeline.module.js';
import { OpenAIService } from '../src/openai/openai.service.js';

const startedAt = Date.now();

async function main(): Promise<void> {
  console.log('1. Démarrage Nest...');

  const app = await NestFactory.createApplicationContext(
    EmbeddingPipelineModule,
    {
      logger: ['error', 'warn', 'log'],
    },
  );

  console.log('2. Nest démarré');

  try {
    console.log('3. Récupération OpenAIService...');

    const openAIService = app.get(OpenAIService);

    console.log('4. OpenAIService récupéré');
    console.log(
      `5. Modèle embedding : ${openAIService.getEmbeddingModel()}`,
    );

    console.log('6. Lancement de l embedding...');

    const result = await embedCodePenal(openAIService);

    console.log(
      `Embedding terminé : ${result.stats.outputRecordCount} records (${result.stats.batchCount} batches)`,
    );

    console.log(`Dimensions : ${result.config.dimensions}`);
    console.log(`Durée : ${Date.now() - startedAt} ms`);
    console.log('Sortie : data/processed/code-penal.embeddings.json');
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
