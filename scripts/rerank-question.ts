import { NestFactory } from '@nestjs/core';

import {
  DEFAULT_RERANK_TOP_K,
  DEFAULT_RETRIEVAL_TOP_K,
} from '../src/reranking/constants.js';
import { RerankingPipelineModule } from '../src/reranking/reranking-pipeline.module.js';
import { searchAndRerankQuestion } from '../src/reranking/search-and-rerank-question.js';
import { OpenAIService } from '../src/openai/openai.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const CONTENT_PREVIEW_LENGTH = 120;

function parseArgs(argv: string[]): {
  question: string;
  retrievalTopK: number;
  rerankTopK: number;
} {
  let retrievalTopK = DEFAULT_RETRIEVAL_TOP_K;
  let rerankTopK = DEFAULT_RERANK_TOP_K;
  const questionParts: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--retrievalTopK' && argv[i + 1]) {
      retrievalTopK = Number(argv[++i]);
    } else if (arg === '--rerankTopK' && argv[i + 1]) {
      rerankTopK = Number(argv[++i]);
    } else if (arg && !arg.startsWith('--')) {
      questionParts.push(arg);
    }
  }

  const question = questionParts.join(' ').trim();
  if (!question) {
    throw new Error(
      'Usage: pnpm rerank:question -- [--retrievalTopK 20] [--rerankTopK 5] "Votre question ici"',
    );
  }

  return { question, retrievalTopK, rerankTopK };
}

async function main(): Promise<void> {
  const { question, retrievalTopK, rerankTopK } = parseArgs(process.argv.slice(2));
  const startedAt = Date.now();

  const app = await NestFactory.createApplicationContext(RerankingPipelineModule, {
    logger: ['error', 'warn'],
  });

  try {
    const prisma = app.get(PrismaService);
    const openAIService = app.get(OpenAIService);
    const { candidates, reranked } = await searchAndRerankQuestion(
      prisma,
      openAIService,
      question,
      { retrievalTopK, rerankTopK },
    );

    console.log(`Question : ${question}`);
    console.log(`Candidats récupérés : ${candidates.length}`);
    console.log(`Après reranking      : ${reranked.length}`);
    console.log('');

    for (const [index, result] of reranked.entries()) {
      const preview =
        result.content.length > CONTENT_PREVIEW_LENGTH
          ? `${result.content.slice(0, CONTENT_PREVIEW_LENGTH)}...`
          : result.content;

      console.log(`#${index + 1} article ${result.articleNumber}`);
      console.log(`   distance vectorielle : ${result.distance.toFixed(4)}`);
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
