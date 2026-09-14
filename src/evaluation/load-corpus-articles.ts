import { readFile } from 'node:fs/promises';

import type { PenalCodeChunkingResult } from '../chunking/types.js';
import { EvaluationError } from './evaluation.error.js';

export async function loadCorpusArticleNumbers(
  chunksPath: string,
): Promise<Set<string>> {
  let raw: string;
  try {
    raw = await readFile(chunksPath, 'utf-8');
  } catch (error) {
    throw new EvaluationError(
      `Corpus chunks file not found: ${chunksPath}`,
      'CORPUS_NOT_FOUND',
      error,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new EvaluationError(
      `Invalid JSON in corpus chunks file: ${chunksPath}`,
      'CORPUS_INVALID',
      error,
    );
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !Array.isArray((parsed as PenalCodeChunkingResult).chunks)
  ) {
    throw new EvaluationError(
      `Corpus chunks file must contain a chunks array: ${chunksPath}`,
      'CORPUS_INVALID',
    );
  }

  const articleNumbers = new Set<string>();
  for (const chunk of (parsed as PenalCodeChunkingResult).chunks) {
    if (typeof chunk.articleNumber === 'string' && chunk.articleNumber.length > 0) {
      articleNumbers.add(chunk.articleNumber);
    }
  }

  if (articleNumbers.size === 0) {
    throw new EvaluationError(
      `No article numbers found in corpus chunks file: ${chunksPath}`,
      'CORPUS_EMPTY',
    );
  }

  return articleNumbers;
}
