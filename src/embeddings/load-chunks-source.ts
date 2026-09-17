import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import type { PenalCodeChunkingResult } from '../chunking/types.js';
import { getCorpusConfig } from '../ingestion/corpus-config.js';
import { corpusChunksPath } from './corpus-paths.js';
import { EmbeddingPipelineError } from './embedding-pipeline.error.js';
import { validateInputChunks } from './validate-embeddings.js';

export async function loadChunksSource(
  corpusId: string,
  chunksPath?: string,
): Promise<PenalCodeChunkingResult> {
  getCorpusConfig(corpusId);

  const resolvedPath = resolve(chunksPath ?? corpusChunksPath(corpusId));

  try {
    await access(resolvedPath);
  } catch {
    throw new EmbeddingPipelineError(
      `Chunks file not found: ${resolvedPath}`,
      'CHUNKS_FILE_NOT_FOUND',
    );
  }

  let chunkingResult: PenalCodeChunkingResult;
  try {
    chunkingResult = JSON.parse(
      await readFile(resolvedPath, 'utf-8'),
    ) as PenalCodeChunkingResult;
  } catch (error) {
    throw new EmbeddingPipelineError(
      `Unable to read chunks file: ${resolvedPath}`,
      'CHUNKS_FILE_INVALID',
      error,
    );
  }

  if (!Array.isArray(chunkingResult.chunks)) {
    throw new EmbeddingPipelineError(
      `Invalid chunks file structure: ${resolvedPath}`,
      'CHUNKS_FILE_INVALID',
    );
  }

  if (
    chunkingResult.corpusId &&
    chunkingResult.corpusId !== corpusId
  ) {
    throw new EmbeddingPipelineError(
      `Corpus mismatch in chunks file: expected ${corpusId}, found ${chunkingResult.corpusId}`,
      'CORPUS_ID_MISMATCH',
    );
  }

  validateInputChunks(chunkingResult.chunks);

  return chunkingResult;
}
