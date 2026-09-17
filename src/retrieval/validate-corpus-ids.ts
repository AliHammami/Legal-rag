import { getCorpusConfig } from '../ingestion/corpus-config.js';
import { RetrievalError } from './retrieval.error.js';

export function validateCorpusIds(corpusIds?: string[]): string[] | undefined {
  if (corpusIds === undefined) {
    return undefined;
  }

  if (corpusIds.length === 0) {
    throw new RetrievalError(
      'corpusIds must not be empty; omit the option to search all corpora',
      'CORPUS_IDS_EMPTY',
    );
  }

  const normalized: string[] = [];
  const seen = new Set<string>();

  for (const corpusId of corpusIds) {
    try {
      getCorpusConfig(corpusId);
    } catch {
      throw new RetrievalError(
        `Corpus inconnu : ${corpusId}`,
        'CORPUS_UNKNOWN',
      );
    }

    if (!seen.has(corpusId)) {
      seen.add(corpusId);
      normalized.push(corpusId);
    }
  }

  return normalized;
}
