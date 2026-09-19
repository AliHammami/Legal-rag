import type { RerankedChunk } from '../reranking/types.js';
import type { BuiltRagContext, ContextSource } from './types.js';

export function formatSourceBlockHeader(
  source: Pick<ContextSource, 'sourceId' | 'articleNumber' | 'chunkIndex'>,
): string {
  return `[Source ${source.sourceId} — Article ${source.articleNumber} — chunk ${source.chunkIndex}]`;
}

function formatSourceBlock(source: ContextSource): string {
  return `${formatSourceBlockHeader(source)}\n${source.content}`;
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
