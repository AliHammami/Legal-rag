import { readFile } from 'node:fs/promises';

import type { PenalCodeChunkingResult } from '../chunking/types.js';
import type { PenalCodeIngestionResult } from '../ingestion/types.js';
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

export async function loadCorpusArticleNumbersFromArticlesFile(
  articlesPath: string,
): Promise<Set<string>> {
  let raw: string;
  try {
    raw = await readFile(articlesPath, 'utf-8');
  } catch (error) {
    throw new EvaluationError(
      `Corpus articles file not found: ${articlesPath}`,
      'CORPUS_NOT_FOUND',
      error,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new EvaluationError(
      `Invalid JSON in corpus articles file: ${articlesPath}`,
      'CORPUS_INVALID',
      error,
    );
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !Array.isArray((parsed as PenalCodeIngestionResult).articles)
  ) {
    throw new EvaluationError(
      `Corpus articles file must contain an articles array: ${articlesPath}`,
      'CORPUS_INVALID',
    );
  }

  const articleNumbers = new Set<string>();
  for (const article of (parsed as PenalCodeIngestionResult).articles) {
    if (
      typeof article.articleNumber === 'string' &&
      article.articleNumber.length > 0
    ) {
      articleNumbers.add(article.articleNumber);
    }
  }

  if (articleNumbers.size === 0) {
    throw new EvaluationError(
      `No article numbers found in corpus articles file: ${articlesPath}`,
      'CORPUS_EMPTY',
    );
  }

  return articleNumbers;
}
