import { resolve } from 'node:path';

import type { OpenAIService } from '../openai/openai.service.js';
import { OpenAIErrorMapper } from '../openai/openai-error.mapper.js';
import { buildBatches } from './batch-chunks.js';
import {
  corpusChunksPath,
  corpusEmbeddingReportPath,
  corpusEmbeddingsPath,
} from './corpus-paths.js';
import {
  DEFAULT_BATCH_SIZE,
  EMBEDDING_DIMENSIONS,
} from './constants.js';
import { EmbeddingPipelineError } from './embedding-pipeline.error.js';
import { loadChunksSource } from './load-chunks-source.js';
import {
  mapBatchToEmbeddedChunks,
  normalizeEmbeddingVectors,
} from './map-embeddings.js';
import type { CorpusEmbeddedChunk, CorpusEmbeddingResult } from './types.js';
import {
  validateOutputRecords,
  validateRecordsMatchSource,
} from './validate-embeddings.js';
import { writeEmbeddingsResultAtomically } from './write-embeddings-result.js';
import { writeJsonAtomically } from './write-json-atomically.js';

export interface GenerateCorpusEmbeddingsOptions {
  chunksPath?: string;
  outputPath?: string;
  reportPath?: string;
  batchSize?: number;
  embeddingModel?: string;
}

/** @deprecated Use GenerateCorpusEmbeddingsOptions */
export type EmbedCodePenalOptions = GenerateCorpusEmbeddingsOptions;

export async function generateCorpusEmbeddings(
  openAIService: OpenAIService,
  corpusId: string,
  options: GenerateCorpusEmbeddingsOptions = {},
): Promise<CorpusEmbeddingResult> {
  const startedAt = Date.now();
  const resolvedChunksPath = resolve(
    options.chunksPath ?? corpusChunksPath(corpusId),
  );
  const outputPath = resolve(
    options.outputPath ?? corpusEmbeddingsPath(corpusId),
  );
  const reportPath = resolve(
    options.reportPath ?? corpusEmbeddingReportPath(corpusId),
  );
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
  const embeddingModel = options.embeddingModel ?? openAIService.getEmbeddingModel();

  const chunkingResult = await loadChunksSource(corpusId, resolvedChunksPath);
  const chunks = chunkingResult.chunks;
  const batches = buildBatches(chunks, batchSize);
  const records: CorpusEmbeddedChunk[] = [];

  try {
    for (const batch of batches) {
      const inputs = batch.map((chunk) => chunk.content);
      const apiResults = await openAIService.createEmbeddings(inputs);
      const vectors = normalizeEmbeddingVectors(apiResults, batch.length);
      records.push(...mapBatchToEmbeddedChunks(corpusId, batch, vectors));
    }
  } catch (error) {
    if (error instanceof EmbeddingPipelineError) {
      throw error;
    }
    const mapper = new OpenAIErrorMapper();
    const mapped = mapper.map(error);
    throw new EmbeddingPipelineError(mapped.message, mapped.code, error);
  }

  const { missingChunks, duplicateChunkIds } = validateOutputRecords(
    chunks,
    records,
  );
  validateRecordsMatchSource(chunks, records);

  const result: CorpusEmbeddingResult = {
    corpusId,
    source: {
      corpusId,
      chunksFile: options.chunksPath ?? resolvedChunksPath,
      chunksExtractedAt: chunkingResult.chunkedAt,
      chunkCount: chunks.length,
    },
    embeddedAt: new Date().toISOString(),
    config: {
      model: embeddingModel,
      dimensions: EMBEDDING_DIMENSIONS,
      batchSize,
    },
    stats: {
      inputChunkCount: chunks.length,
      outputRecordCount: records.length,
      batchCount: batches.length,
      durationMs: Date.now() - startedAt,
      missingChunks,
      duplicateChunkIds,
    },
    records,
  };

  const report = {
    corpusId,
    ...result.stats,
    config: result.config,
  };

  await writeEmbeddingsResultAtomically(outputPath, result);
  await writeJsonAtomically(reportPath, report);

  return result;
}
