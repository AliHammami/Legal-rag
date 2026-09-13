import type { CreateEmbeddingsResult } from '../openai/openai.service.js';
import type { PenalCodeChunk } from '../chunking/types.js';
import { EmbeddingPipelineError } from './embedding-pipeline.error.js';
import type { PenalCodeEmbeddedChunk } from './types.js';

export function normalizeEmbeddingVectors(
  results: CreateEmbeddingsResult[],
  expectedCount: number,
): number[][] {
  if (results.length !== expectedCount) {
    throw new EmbeddingPipelineError(
      `Expected ${expectedCount} embeddings, received ${results.length}`,
      'EMBEDDING_COUNT_MISMATCH',
    );
  }

  const seenIndices = new Set<number>();
  for (const result of results) {
    if (!Number.isInteger(result.index) || result.index < 0 || result.index >= expectedCount) {
      throw new EmbeddingPipelineError(
        `Invalid embedding index: ${result.index}`,
        'EMBEDDING_INDEX_INVALID',
      );
    }
    if (seenIndices.has(result.index)) {
      throw new EmbeddingPipelineError(
        `Duplicate embedding index: ${result.index}`,
        'EMBEDDING_INDEX_DUPLICATE',
      );
    }
    seenIndices.add(result.index);
  }

  if (seenIndices.size !== expectedCount) {
    throw new EmbeddingPipelineError(
      `Missing embedding indices: expected 0..${expectedCount - 1}`,
      'EMBEDDING_INDEX_MISSING',
    );
  }

  return [...results]
    .sort((a, b) => a.index - b.index)
    .map((result) => result.embedding);
}

export function mapBatchToEmbeddedChunks(
  chunks: PenalCodeChunk[],
  embeddingVectors: number[][],
): PenalCodeEmbeddedChunk[] {
  if (chunks.length !== embeddingVectors.length) {
    throw new EmbeddingPipelineError(
      `Chunk/embedding length mismatch: ${chunks.length} vs ${embeddingVectors.length}`,
      'EMBEDDING_MAPPING_MISMATCH',
    );
  }

  return chunks.map((chunk, index) => ({
    chunkId: chunk.chunkId,
    articleNumber: chunk.articleNumber,
    content: chunk.content,
    charCount: chunk.charCount,
    embedding: embeddingVectors[index]!,
    metadata: chunk.metadata,
  }));
}
