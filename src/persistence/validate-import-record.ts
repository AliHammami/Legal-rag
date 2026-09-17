import { validateEmbeddingVector } from '../embeddings/validate-embeddings.js';
import type { CorpusEmbeddedChunk } from '../embeddings/types.js';
import { PersistenceError } from './persistence.error.js';

export function validateImportRecord(
  record: CorpusEmbeddedChunk,
  seenChunkIds: Set<string>,
): void {
  if (!record.chunkId) {
    throw new PersistenceError('Chunk missing chunkId', 'CHUNK_ID_MISSING');
  }

  if (seenChunkIds.has(record.chunkId)) {
    throw new PersistenceError(
      `Duplicate chunkId in input: ${record.chunkId}`,
      'CHUNK_ID_DUPLICATE',
    );
  }
  seenChunkIds.add(record.chunkId);

  if (!record.content.trim()) {
    throw new PersistenceError(
      `Empty content for chunk ${record.chunkId}`,
      'CHUNK_CONTENT_EMPTY',
    );
  }

  if (record.content.length !== record.charCount) {
    throw new PersistenceError(
      `charCount mismatch for ${record.chunkId}: stored ${record.charCount}, actual ${record.content.length}`,
      'CHAR_COUNT_MISMATCH',
    );
  }

  validateEmbeddingVector(record.embedding, record.chunkId);
}
