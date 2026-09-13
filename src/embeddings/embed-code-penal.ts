import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { PenalCodeChunkingResult } from '../chunking/types.js';
import type { OpenAIService } from '../openai/openai.service.js';
import { OpenAIErrorMapper } from '../openai/openai-error.mapper.js';
import { buildBatches } from './batch-chunks.js';
import {
  DEFAULT_BATCH_SIZE,
  DEFAULT_CHUNKS_FILE,
  DEFAULT_EMBEDDING_MODEL,
  DEFAULT_OUTPUT_FILE,
  DEFAULT_REPORT_FILE,
  EMBEDDING_DIMENSIONS,
} from './constants.js';
import { EmbeddingPipelineError } from './embedding-pipeline.error.js';
import {
  mapBatchToEmbeddedChunks,
  normalizeEmbeddingVectors,
} from './map-embeddings.js';
import type { PenalCodeEmbeddedChunk, PenalCodeEmbeddingResult } from './types.js';
import {
  validateInputChunks,
  validateOutputRecords,
} from './validate-embeddings.js';

export interface EmbedCodePenalOptions {
  chunksPath?: string;
  outputPath?: string;
  reportPath?: string;
  batchSize?: number;
  embeddingModel?: string;
}

export async function embedCodePenal(
  openAIService: OpenAIService,
  options: EmbedCodePenalOptions = {},
): Promise<PenalCodeEmbeddingResult> {
  const startedAt = Date.now();
  const chunksPath = resolve(options.chunksPath ?? DEFAULT_CHUNKS_FILE);
  const outputPath = resolve(options.outputPath ?? DEFAULT_OUTPUT_FILE);
  const reportPath = resolve(options.reportPath ?? DEFAULT_REPORT_FILE);
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
  const embeddingModel = options.embeddingModel ?? openAIService.getEmbeddingModel();

  let chunkingResult: PenalCodeChunkingResult;
  try {
    chunkingResult = JSON.parse(await readFile(chunksPath, 'utf-8')) as PenalCodeChunkingResult;
  } catch (error) {
    throw new EmbeddingPipelineError(
      `Unable to read chunks file: ${chunksPath}`,
      'CHUNKS_FILE_INVALID',
      error,
    );
  }

  const chunks = chunkingResult.chunks;
  validateInputChunks(chunks);

  const batches = buildBatches(chunks, batchSize);
  const records: PenalCodeEmbeddedChunk[] = [];

  try {
    for (const batch of batches) {
      const inputs = batch.map((chunk) => chunk.content);
      const apiResults = await openAIService.createEmbeddings(inputs);
      const vectors = normalizeEmbeddingVectors(apiResults, batch.length);
      records.push(...mapBatchToEmbeddedChunks(batch, vectors));
    }
  } catch (error) {
    if (error instanceof EmbeddingPipelineError) {
      throw error;
    }
    const mapper = new OpenAIErrorMapper();
    const mapped = mapper.map(error);
    throw new EmbeddingPipelineError(mapped.message, mapped.code, error);
  }

  const { missingChunks, duplicateChunkIds } = validateOutputRecords(chunks, records);

  const result: PenalCodeEmbeddingResult = {
    source: {
      chunksFile: options.chunksPath ?? DEFAULT_CHUNKS_FILE,
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
    ...result.stats,
    config: result.config,
  };

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(result, null, 2), 'utf-8');
  await writeFile(reportPath, JSON.stringify(report, null, 2), 'utf-8');

  return result;
}
