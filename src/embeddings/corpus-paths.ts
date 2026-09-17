import { getCorpusConfig } from '../ingestion/corpus-config.js';

export function corpusChunksPath(corpusId: string): string {
  return getCorpusConfig(corpusId).chunksOutputPath;
}

export function corpusEmbeddingsPath(corpusId: string): string {
  return `data/processed/${corpusId}.embeddings.json`;
}

export function corpusEmbeddingReportPath(corpusId: string): string {
  return `data/processed/${corpusId}.embedding-report.json`;
}
