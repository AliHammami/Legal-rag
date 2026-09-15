import type { RerankedChunk } from '../reranking/types.js';
import type { BuiltRagContext, ContextSource } from './types.js';

function formatSourceBlock(source: ContextSource): string {
  return `[Source ${source.sourceId} — Article ${source.articleNumber} — chunk ${source.chunkIndex}]\n${source.content}`;
}

export function buildRagContext(chunks: RerankedChunk[]): BuiltRagContext {
  const sources: ContextSource[] = chunks.map((chunk, index) => ({
    sourceId: index + 1,
    chunkId: chunk.chunkId,
    articleNumber: chunk.articleNumber,
    chunkIndex: chunk.metadata.chunkIndex,
    content: chunk.content,
    chunk,
  }));

  return {
    context: sources.map(formatSourceBlock).join('\n\n'),
    sources,
  };
}
