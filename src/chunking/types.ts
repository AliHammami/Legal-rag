import type { PenalCodeArticleMetadata } from '../ingestion/types.js';

export type LegalUnitType =
  | 'paragraph'
  | 'list-item'
  | 'roman-section'
  | 'alpha-item';

export interface LegalUnit {
  index: number;
  type: LegalUnitType;
  text: string;
}

export type SplitLevel = 'unit' | 'sentence' | 'hard';

export interface ChunkingConfig {
  targetSize: number;
  maxSize: number;
}

export interface PenalCodeChunkMetadata extends PenalCodeArticleMetadata {
  chunkIndex: number;
  chunkCount: number;
  unitStart: number;
  unitEnd: number;
  unitCount: number;
  splitLevel?: SplitLevel;
}

export interface PenalCodeChunk {
  chunkId: string;
  articleNumber: string;
  content: string;
  charCount: number;
  metadata: PenalCodeChunkMetadata;
}

export interface PenalCodeChunkingStats {
  articleCount: number;
  chunkCount: number;
  singleChunkArticles: number;
  multiChunkArticles: number;
  maxChunkSize: number;
  avgChunkSize: number;
  chunksOverMax: number;
  sentenceSplitUnits: number;
  hardSplitUnits: number;
  oversizedArticlesChunked?: number;
}

export interface PenalCodeChunkingResult {
  corpusId?: string;
  codeName?: string;
  source: {
    articlesFile: string;
    ingestionExtractedAt?: string;
    articleCount: number;
  };
  chunkedAt: string;
  config: ChunkingConfig;
  stats: PenalCodeChunkingStats;
  chunks: PenalCodeChunk[];
}
