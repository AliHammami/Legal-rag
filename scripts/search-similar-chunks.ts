import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';

import type { PenalCodeEmbeddingResult } from '../src/embeddings/types.js';
import {
  DEFAULT_EMBEDDINGS_FILE,
  DEFAULT_SOURCE_CHUNK_ID,
  DEFAULT_TOP_K,
} from '../src/retrieval/constants.js';
import { RetrievalPipelineModule } from '../src/retrieval/retrieval-pipeline.module.js';
import { searchSimilarChunks } from '../src/retrieval/search-similar-chunks.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const CONTENT_PREVIEW_LENGTH = 80;

function parseArgs(argv: string[]): {
  topK: number;
  sourceChunkId: string;
  embeddingsFile: string;
} {
  let topK = DEFAULT_TOP_K;
  let sourceChunkId = DEFAULT_SOURCE_CHUNK_ID;
  let embeddingsFile = DEFAULT_EMBEDDINGS_FILE;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--topK' && argv[i + 1]) {
      topK = Number(argv[++i]);
    } else if (arg === '--source-chunk-id' && argv[i + 1]) {
      sourceChunkId = argv[++i]!;
    } else if (arg === '--embeddings-file' && argv[i + 1]) {
      embeddingsFile = argv[++i]!;
    }
  }

  return { topK, sourceChunkId, embeddingsFile: resolve(embeddingsFile) };
}

async function loadQueryEmbedding(
  embeddingsFile: string,
  sourceChunkId: string,
): Promise<number[]> {
  const raw = await readFile(embeddingsFile, 'utf-8');
  const data = JSON.parse(raw) as PenalCodeEmbeddingResult;
  const record = data.records.find((item) => item.chunkId === sourceChunkId);

  if (!record) {
    throw new Error(`Chunk not found in embeddings file: ${sourceChunkId}`);
  }

  return record.embedding;
}

async function main(): Promise<void> {
  const { topK, sourceChunkId, embeddingsFile } = parseArgs(process.argv.slice(2));
  const startedAt = Date.now();

  const queryEmbedding = await loadQueryEmbedding(embeddingsFile, sourceChunkId);

  const app = await NestFactory.createApplicationContext(RetrievalPipelineModule, {
    logger: ['error', 'warn'],
  });

  try {
    const prisma = app.get(PrismaService);
    const results = await searchSimilarChunks(prisma, queryEmbedding, topK);

    console.log(`Source chunk : ${sourceChunkId}`);
    console.log(`Top-K        : ${topK}`);
    console.log(`Résultats    : ${results.length}`);
    console.log('');

    for (const [index, result] of results.entries()) {
      const preview =
        result.content.length > CONTENT_PREVIEW_LENGTH
          ? `${result.content.slice(0, CONTENT_PREVIEW_LENGTH)}...`
          : result.content;

      console.log(
        `#${index + 1} ${result.chunkId} | ${result.articleNumber} | distance=${result.distance.toFixed(4)}`,
      );
      console.log(`   ${preview}`);
    }

    const distances = results.map((r) => r.distance);
    const isAscending = distances.every(
      (distance, index) => index === 0 || distance >= distances[index - 1]!,
    );

    console.log('');
    console.log(`Durée : ${Date.now() - startedAt} ms`);
    console.log(`Premier résultat : ${results[0]?.chunkId ?? 'n/a'}`);
    console.log(`Distance premier : ${results[0]?.distance.toFixed(6) ?? 'n/a'}`);
    console.log(`Distances croissantes : ${isAscending ? 'oui' : 'non'}`);
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
