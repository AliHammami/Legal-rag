import type { PenalCodeChunk } from '../chunking/types.js';
import { EMBEDDING_DIMENSIONS } from './constants.js';
import { EmbeddingPipelineError } from './embedding-pipeline.error.js';
import type { PenalCodeEmbeddedChunk } from './types.js';

export function validateInputChunks(chunks: PenalCodeChunk[]): void {
  if (chunks.length === 0) {
    throw new EmbeddingPipelineError('No chunks to embed', 'CHUNKS_EMPTY');
  }

  const seenChunkIds = new Set<string>();
  for (const chunk of chunks) {
    if (!chunk.chunkId) {
      throw new EmbeddingPipelineError('Chunk missing chunkId', 'CHUNK_ID_MISSING');
    }
    if (seenChunkIds.has(chunk.chunkId)) {
      throw new EmbeddingPipelineError(
        `Duplicate chunkId in input: ${chunk.chunkId}`,
        'CHUNK_ID_DUPLICATE',
      );
    }
    seenChunkIds.add(chunk.chunkId);

    if (!chunk.content.trim()) {
      throw new EmbeddingPipelineError(
        `Empty content for chunk ${chunk.chunkId}`,
        'CHUNK_CONTENT_EMPTY',
      );
    }

    if (chunk.content.length !== chunk.charCount) {
      throw new EmbeddingPipelineError(
        `charCount mismatch for ${chunk.chunkId}: stored ${chunk.charCount}, actual ${chunk.content.length}`,
        'CHAR_COUNT_MISMATCH',
      );
    }
  }
}

export function validateRecordsMatchSource(
  inputChunks: PenalCodeChunk[],
  records: PenalCodeEmbeddedChunk[],
): void {
  const sourceById = new Map(inputChunks.map((chunk) => [chunk.chunkId, chunk]));

  for (const record of records) {
    const source = sourceById.get(record.chunkId);
    if (!source) {
      continue;
    }

    if (record.content !== source.content) {
      throw new EmbeddingPipelineError(
        `Content mismatch for ${record.chunkId}`,
        'OUTPUT_CONTENT_MISMATCH',
      );
    }

    if (record.charCount !== source.charCount) {
      throw new EmbeddingPipelineError(
        `charCount mismatch in output for ${record.chunkId}`,
        'OUTPUT_CHAR_COUNT_MISMATCH',
      );
    }

    if (record.articleNumber !== source.articleNumber) {
      throw new EmbeddingPipelineError(
        `articleNumber mismatch in output for ${record.chunkId}`,
        'OUTPUT_ARTICLE_NUMBER_MISMATCH',
      );
    }

    if (JSON.stringify(record.metadata) !== JSON.stringify(source.metadata)) {
      throw new EmbeddingPipelineError(
        `metadata mismatch in output for ${record.chunkId}`,
        'OUTPUT_METADATA_MISMATCH',
      );
    }
  }
}

export function validateEmbeddingVector(
  embedding: number[],
  chunkId: string,
  expectedDimensions: number = EMBEDDING_DIMENSIONS,
): void {
  if (embedding.length !== expectedDimensions) {
    throw new EmbeddingPipelineError(
      `Invalid embedding dimension for ${chunkId}: ${embedding.length} (expected ${expectedDimensions})`,
      'EMBEDDING_DIMENSION_INVALID',
    );
  }

  for (const value of embedding) {
    if (!Number.isFinite(value)) {
      throw new EmbeddingPipelineError(
        `Non-finite embedding value for ${chunkId}`,
        'EMBEDDING_VALUE_INVALID',
      );
    }
  }
}

export function validateOutputRecords(
  inputChunks: PenalCodeChunk[],
  records: PenalCodeEmbeddedChunk[],
  expectedDimensions: number = EMBEDDING_DIMENSIONS,
): { missingChunks: number; duplicateChunkIds: number } {
  const inputIds = new Set(inputChunks.map((chunk) => chunk.chunkId));
  const outputIds = new Set<string>();
  let duplicateChunkIds = 0;

  if (records.length !== inputChunks.length) {
    throw new EmbeddingPipelineError(
      `Output record count mismatch: ${records.length} vs ${inputChunks.length}`,
      'OUTPUT_COUNT_MISMATCH',
    );
  }

  for (const record of records) {
    if (outputIds.has(record.chunkId)) {
      duplicateChunkIds++;
    }
    outputIds.add(record.chunkId);

    if (!inputIds.has(record.chunkId)) {
      throw new EmbeddingPipelineError(
        `Unexpected chunkId in output: ${record.chunkId}`,
        'OUTPUT_CHUNK_UNKNOWN',
      );
    }

    validateEmbeddingVector(record.embedding, record.chunkId, expectedDimensions);
  }

  const missingChunks = inputChunks.filter((chunk) => !outputIds.has(chunk.chunkId)).length;
  if (missingChunks > 0) {
    throw new EmbeddingPipelineError(
      `Missing ${missingChunks} chunks in output`,
      'OUTPUT_CHUNK_MISSING',
    );
  }

  return { missingChunks, duplicateChunkIds };
}
