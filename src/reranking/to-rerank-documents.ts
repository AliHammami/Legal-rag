import type { SimilarChunk } from '../retrieval/types.js';
import type { RerankDocument } from './types.js';

export function toRerankDocuments(chunks: SimilarChunk[]): RerankDocument[] {
  return chunks.map((chunk) => ({
    chunkId: chunk.chunkId,
    content: chunk.content,
  }));
}
