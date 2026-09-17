export { DEFAULT_OUTPUT_FILE as DEFAULT_EMBEDDINGS_FILE } from '../embeddings/constants.js';

export const IMPORT_BATCH_SIZE = 128;

/** Timeout transaction import (~33k chunks / batch 128). */
export const IMPORT_TRANSACTION_TIMEOUT_MS = 300_000;

export const LEGAL_CODE_CHUNKS_TABLE = 'legal_code_chunks';

export const DEFAULT_CODE_PENAL_CORPUS_ID = 'code-penal';

export function corpusEmbeddingsPath(corpusId: string): string {
  return `data/processed/${corpusId}.embeddings.json`;
}
