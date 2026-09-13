export interface ImportCodePenalOptions {
  embeddingsPath?: string;
  batchSize?: number;
}

export interface ImportStats {
  inputRecordCount: number;
  batchCount: number;
  durationMs: number;
}

export interface ImportVerification {
  totalRows: number;
  invalidDimensionRows: number;
  duplicateChunkIds: number;
}

export interface ImportResult {
  source: {
    embeddingsFile: string;
    embeddedAt: string;
    embeddingModel: string;
  };
  importedAt: string;
  stats: ImportStats;
  verification: ImportVerification;
}
