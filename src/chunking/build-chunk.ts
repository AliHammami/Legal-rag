import type { PenalCodeArticle } from '../ingestion/types.js';
import type { PenalCodeChunk, SplitLevel } from './types.js';

export function normalizeSourcePath(source: string): string {
  if (
    source.endsWith('data/code-penal.pdf') ||
    source.includes('/data/code-penal.pdf')
  ) {
    return 'data/code-penal.pdf';
  }
  return source;
}

export interface BuildChunkOptions {
  article: PenalCodeArticle;
  content: string;
  chunkIndex: number;
  chunkCount: number;
  unitStart: number;
  unitEnd: number;
  unitCount: number;
  splitLevel?: SplitLevel;
}

export function buildChunkFromParts(options: BuildChunkOptions): PenalCodeChunk {
  const {
    article,
    content,
    chunkIndex,
    chunkCount,
    unitStart,
    unitEnd,
    unitCount,
    splitLevel,
  } = options;

  const metadata = {
    ...article.metadata,
    source: normalizeSourcePath(article.metadata.source),
    chunkIndex,
    chunkCount,
    unitStart,
    unitEnd,
    unitCount,
    ...(splitLevel && splitLevel !== 'unit' ? { splitLevel } : {}),
  };

  return {
    chunkId: `${article.articleNumber}#${chunkIndex}`,
    articleNumber: article.articleNumber,
    content,
    charCount: content.length,
    metadata,
  };
}
