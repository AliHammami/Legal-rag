import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';

import { OpenAIService } from '../src/openai/openai.service.js';
import { ROUTING_MODEL_ENV } from '../src/routing/constants.js';
import { routeQuestion } from '../src/routing/route-question.js';
import { RoutingPipelineModule } from '../src/routing/routing-pipeline.module.js';

function parseQuestion(argv: string[]): string {
  const questionParts: string[] = [];

  for (const arg of argv) {
    if (arg && !arg.startsWith('--')) {
      questionParts.push(arg);
    }
  }

  const question = questionParts.join(' ').trim();
  if (!question) {
    throw new Error('Usage: pnpm route:question -- "Votre question ici"');
  }

  return question;
}

async function main(): Promise<void> {
  const question = parseQuestion(process.argv.slice(2));
  const startedAt = Date.now();

  const app = await NestFactory.createApplicationContext(RoutingPipelineModule, {
    logger: ['error', 'warn'],
  });

  try {
    const openAIService = app.get(OpenAIService);
    const configService = app.get(ConfigService);
    const model = configService.get<string>(ROUTING_MODEL_ENV);

    const result = await routeQuestion(openAIService, question, { model });

    console.log('Question:');
    console.log(question);
    console.log('');
    console.log('Selected corpora:');

    if (result.corpusIds.length === 0) {
      console.log('- (none)');
    } else {
      for (const corpusId of result.corpusIds) {
        console.log(`- ${corpusId}`);
      }
    }

    if (result.reason) {
      console.log('');
      console.log('Reason:');
      console.log(result.reason);
    }

    console.log('');
    console.log(`Durée : ${Date.now() - startedAt} ms`);
  } finally {
    await app.close();
  }
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
