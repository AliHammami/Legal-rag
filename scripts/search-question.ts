import { NestFactory } from '@nestjs/core';

import { OpenAIService } from '../src/openai/openai.service.js';
import { DEFAULT_TOP_K } from '../src/retrieval/constants.js';
import { RetrievalPipelineModule } from '../src/retrieval/retrieval-pipeline.module.js';
import { searchQuestion } from '../src/retrieval/search-question.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const CONTENT_PREVIEW_LENGTH = 120;

function parseArgs(argv: string[]): {
  question: string;
  topK: number;
  corpusIds?: string[];
} {
  let topK = DEFAULT_TOP_K;
  let corpusIds: string[] | undefined;
  const questionParts: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--topK' && argv[i + 1]) {
      topK = Number(argv[++i]);
    } else if (arg === '--corpus' && argv[i + 1]) {
      corpusIds ??= [];
      corpusIds.push(argv[++i]!);
    } else if (arg && !arg.startsWith('--')) {
      questionParts.push(arg);
    }
  }

  const question = questionParts.join(' ').trim();
  if (!question) {
    throw new Error(
      'Usage: pnpm search:question -- [--topK 20] [--corpus code-penal] "Votre question ici"',
    );
  }

  return { question, topK, corpusIds };
}

async function main(): Promise<void> {
  const { question, topK, corpusIds } = parseArgs(process.argv.slice(2));
  const startedAt = Date.now();

  const app = await NestFactory.createApplicationContext(RetrievalPipelineModule, {
    logger: ['error', 'warn'],
  });

  try {
    const prisma = app.get(PrismaService);
    const openAIService = app.get(OpenAIService);
    const results = await searchQuestion(prisma, openAIService, question, topK, {
      corpusIds,
    });

    const corpusLabel =
      corpusIds && corpusIds.length > 0
        ? corpusIds.join(', ')
        : 'tous les corpus';

    console.log(`Question : ${question}`);
    console.log(`Corpus   : ${corpusLabel}`);
    console.log(`Top-K    : ${topK}`);
    console.log(`Résultats: ${results.length}`);
    console.log('');

    for (const [index, result] of results.entries()) {
      const preview =
        result.content.length > CONTENT_PREVIEW_LENGTH
          ? `${result.content.slice(0, CONTENT_PREVIEW_LENGTH)}...`
          : result.content;

      console.log(
        `#${index + 1} [${result.corpusId}] Article ${result.articleNumber} | distance=${result.distance.toFixed(4)}`,
      );
      console.log(`   ${preview}`);
    }

    console.log('');
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
