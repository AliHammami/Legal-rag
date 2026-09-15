import { NestFactory } from '@nestjs/core';

import { formatRetrievalDebugReport } from '../src/debug/format-retrieval-debug.js';
import { answerQuestion } from '../src/generation/answer-question.js';
import { GenerationPipelineModule } from '../src/generation/generation-pipeline.module.js';
import { RagGenerationService } from '../src/generation/rag-generation.service.js';
import {
  createPipelineProfiling,
  formatAnswerPerformanceReport,
} from '../src/profiling/pipeline-timings.js';
import { validateContextTopK } from '../src/generation/select-context-chunks.js';
import {
  DEFAULT_RERANK_TOP_K,
  DEFAULT_RETRIEVAL_TOP_K,
} from '../src/reranking/constants.js';
import { JinaRerankerService } from '../src/reranking/jina-reranker.service.js';
import { OpenAIService } from '../src/openai/openai.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

function parseContextTopKArg(arg: string): number {
  const value = Number(arg);
  return validateContextTopK(value);
}

function parseArgs(argv: string[]): {
  question: string;
  retrievalTopK: number;
  rerankTopK: number;
  contextTopK: number | undefined;
  debugRetrieval: boolean;
} {
  let retrievalTopK = DEFAULT_RETRIEVAL_TOP_K;
  let rerankTopK = DEFAULT_RERANK_TOP_K;
  let contextTopK: number | undefined;
  let debugRetrieval = false;
  const questionParts: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--retrievalTopK' && argv[i + 1]) {
      retrievalTopK = Number(argv[++i]);
    } else if (arg === '--rerankTopK' && argv[i + 1]) {
      rerankTopK = Number(argv[++i]);
    } else if (arg === '--context-top-k' && argv[i + 1]) {
      contextTopK = parseContextTopKArg(argv[++i]!);
    } else if (arg?.startsWith('--context-top-k=')) {
      contextTopK = parseContextTopKArg(arg.slice('--context-top-k='.length));
    } else if (arg === '--debug-retrieval') {
      debugRetrieval = true;
    } else if (arg && !arg.startsWith('--')) {
      questionParts.push(arg);
    }
  }

  const question = questionParts.join(' ').trim();
  if (!question) {
    throw new Error(
      'Usage: pnpm search:answer -- [--retrievalTopK 20] [--rerankTopK 5] [--context-top-k=5] [--debug-retrieval] "Votre question ici"',
    );
  }

  return { question, retrievalTopK, rerankTopK, contextTopK, debugRetrieval };
}

async function main(): Promise<void> {
  const { question, retrievalTopK, rerankTopK, contextTopK, debugRetrieval } =
    parseArgs(process.argv.slice(2));
  const profiling = createPipelineProfiling();

  const app = await NestFactory.createApplicationContext(GenerationPipelineModule, {
    logger: ['error', 'warn'],
  });

  try {
    const prisma = app.get(PrismaService);
    const openAIService = app.get(OpenAIService);
    const rerankerService = app.get(JinaRerankerService);
    const generationService = app.get(RagGenerationService);

    const result = await answerQuestion(
      prisma,
      openAIService,
      rerankerService,
      generationService,
      question,
      { retrievalTopK, rerankTopK, contextTopK, profiling },
    );

    console.log(`Question : ${result.question}`);
    console.log(`Statut reranking : ${result.rerankStatus}`);
    console.log(`Context chunks : ${result.contextTopK}`);

    if (debugRetrieval) {
      console.log('');
      console.log(formatRetrievalDebugReport({
        candidates: result.candidates,
        reranked: result.reranked,
      }));
    }

    console.log('');
    console.log('Sources utilisées :');
    for (const source of result.sources) {
      console.log(
        `- Source ${source.sourceId} — Article ${source.articleNumber} — chunk ${source.chunkIndex}`,
      );
    }
    console.log('');
    console.log('Réponse :');
    console.log(result.answer);
    console.log('');
    console.log(formatAnswerPerformanceReport(result.profiling));
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
