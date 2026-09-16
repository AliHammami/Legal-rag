import type { ArticleKind } from './normalize-article-id.js';

export interface PenalCodeSource {
  file: string;
  type: 'pdf';
  producer?: string;
  pageCount: number;
}

export interface PenalCodeArticleMetadata {
  articleNumber: string;
  corpusId?: string;
  codeName?: string;
  rawArticleNumber?: string;
  articleKind?: ArticleKind;
  partie?: string;
  livre?: string;
  titre?: string;
  chapitre?: string;
  section?: string;
  pageStart: number;
  pageEnd: number;
  source: string;
  sourceType: 'pdf';
  contentLength?: number;
  isOversized?: boolean;
}

export interface PenalCodeArticle {
  articleNumber: string;
  content: string;
  metadata: PenalCodeArticleMetadata;
}

export interface CorpusContentStats {
  min: number;
  max: number;
  avg: number;
  median: number;
  gt1500: number;
  gt2000: number;
}

export interface PenalCodeIngestionStats {
  articleCount: number;
  uniqueArticleCount: number;
  duplicateCount: number;
  emptyArticles: number;
  droppedSectionOnlyArticles: number;
  oversizedArticles: number;
  footerPollutionArticles: number;
  contentStats: CorpusContentStats;
  skippedPages: number;
  warnings: string[];
}

export interface PenalCodeIngestionReport {
  lastModified?: string;
  generatedAt?: string;
  durationMs: number;
}

export interface PenalCodeIngestionResult {
  corpusId?: string;
  codeName?: string;
  source: PenalCodeSource;
  extractedAt: string;
  stats: PenalCodeIngestionStats;
  report?: PenalCodeIngestionReport;
  articles: PenalCodeArticle[];
}

export interface ExtractedPage {
  pageNumber: number;
  text: string;
}
