import type { RerankedChunk } from '../reranking/types.js';
import type { BuiltRagContext, ContextSource } from './types.js';

export function resolveChunkCodeName(
  chunk: Pick<RerankedChunk, 'corpusId' | 'metadata'>,
): string {
  const fromMetadata = chunk.metadata.codeName?.trim();
  if (fromMetadata) {
    return fromMetadata;
  }

  return chunk.corpusId;
}

export function formatSourceBlockHeader(
  source: Pick<
    ContextSource,
    'sourceId' | 'codeName' | 'articleNumber' | 'chunkIndex'
  >,
): string {
  return `[Source ${source.sourceId} — ${source.codeName} — Article ${source.articleNumber} — chunk ${source.chunkIndex}]`;
}

function formatSourceBlock(source: ContextSource): string {
  return `${formatSourceBlockHeader(source)}\n${source.content}`;
}

export function buildRagContext(chunks: RerankedChunk[]): BuiltRagContext {
  const sources: ContextSource[] = chunks.map((chunk, index) => ({
    sourceId: index + 1,
    chunkId: chunk.chunkId,
    codeName: resolveChunkCodeName(chunk),
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
