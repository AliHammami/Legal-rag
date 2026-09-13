export interface PenalCodeSource {
  file: string;
  type: 'pdf';
  producer?: string;
  pageCount: number;
}

export interface PenalCodeArticleMetadata {
  articleNumber: string;
  partie?: string;
  livre?: string;
  titre?: string;
  chapitre?: string;
  section?: string;
  pageStart: number;
  pageEnd: number;
  source: string;
  sourceType: 'pdf';
}

export interface PenalCodeArticle {
  articleNumber: string;
  content: string;
  metadata: PenalCodeArticleMetadata;
}

export interface PenalCodeIngestionStats {
  articleCount: number;
  skippedPages: number;
  warnings: string[];
}

export interface PenalCodeIngestionReport {
  lastModified?: string;
  generatedAt?: string;
  durationMs: number;
}

export interface PenalCodeIngestionResult {
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
