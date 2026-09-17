export interface ImportCorpusOptions {
  embeddingsPath?: string;
  batchSize?: number;
  verbose?: boolean;
}

/** @deprecated Use ImportCorpusOptions */
export type ImportCodePenalOptions = ImportCorpusOptions;

export interface ImportStats {
  inputRecordCount: number;
  batchCount: number;
  deletedCount: number;
  deletedChunkIds: string[];
  durationMs: number;
}

export interface ImportVerification {
  corpusId: string;
  totalRows: number;
  rowsWithEmbeddings: number;
  rowsMissingEmbeddings: number;
  invalidDimensionRows: number;
  duplicateCorpusChunkIds: number;
}

export interface GlobalImportVerification {
  totalRows: number;
  totalEmbeddings: number;
  rowsMissingEmbeddings: number;
  invalidDimensionRows: number;
  duplicateCorpusChunkIds: number;
  corpusCounts: Array<{
    corpusId: string;
    rowCount: number;
    rowsWithEmbeddings: number;
  }>;
}

export interface ImportResult {
  corpusId: string;
  source: {
    embeddingsFile: string;
    embeddedAt: string;
    embeddingModel: string;
  };
  importedAt: string;
  stats: ImportStats;
  verification: ImportVerification;
}

export interface CorpusPersistenceValidation {
  corpusId: string;
  rowCount: number;
  uniqueCorpusChunkIds: number;
  duplicateCorpusChunkIds: number;
  rowsMissingContent: number;
  rowsMissingEmbeddings: number;
  rowsWithEmbeddings: number;
  invalidDimensionRows: number;
  embeddingModels: string[];
}

export interface PersistenceValidationReport {
  global: GlobalImportVerification;
  corpora: CorpusPersistenceValidation[];
}
