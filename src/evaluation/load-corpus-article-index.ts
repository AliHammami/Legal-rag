import { readFile } from 'node:fs/promises';

import { ALL_CORPUS_IDS, getCorpusConfig } from '../ingestion/corpus-config.js';
import type { PenalCodeArticle } from '../ingestion/types.js';
import type { PenalCodeIngestionResult } from '../ingestion/types.js';
import { EvaluationError } from './evaluation.error.js';

export interface CorpusArticleRecord {
  corpusId: string;
  articleNumber: string;
  content: string;
  metadata: PenalCodeArticle['metadata'];
}

export type CorpusArticleIndex = Map<string, CorpusArticleRecord>;

export interface MulticorpusCorpusArticleRegistry {
  byCorpus: Map<string, CorpusArticleIndex>;
  allArticleNumbers: Map<string, Set<string>>;
}

async function loadCorpusArticlesFile(
  articlesPath: string,
  corpusId: string,
): Promise<CorpusArticleIndex> {
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

  const index: CorpusArticleIndex = new Map();
  for (const article of (parsed as PenalCodeIngestionResult).articles) {
    if (
      typeof article.articleNumber !== 'string' ||
      article.articleNumber.length === 0 ||
      typeof article.content !== 'string'
    ) {
      continue;
    }

    index.set(article.articleNumber, {
      corpusId,
      articleNumber: article.articleNumber,
      content: article.content,
      metadata: article.metadata,
    });
  }

  if (index.size === 0) {
    throw new EvaluationError(
      `No articles found in corpus articles file: ${articlesPath}`,
      'CORPUS_EMPTY',
    );
  }

  return index;
}

export async function loadMulticorpusCorpusArticleRegistry(
  corpusIds: string[] = ALL_CORPUS_IDS,
): Promise<MulticorpusCorpusArticleRegistry> {
  const byCorpus = new Map<string, CorpusArticleIndex>();
  const allArticleNumbers = new Map<string, Set<string>>();

  for (const corpusId of corpusIds) {
    const config = getCorpusConfig(corpusId);
    const index = await loadCorpusArticlesFile(config.outputPath, corpusId);
    byCorpus.set(corpusId, index);
    allArticleNumbers.set(corpusId, new Set(index.keys()));
  }

  return { byCorpus, allArticleNumbers };
}

export function articleExistsInCorpus(
  registry: MulticorpusCorpusArticleRegistry,
  corpusId: string,
  articleNumber: string,
): boolean {
  return registry.allArticleNumbers.get(corpusId)?.has(articleNumber) ?? false;
}

export function getArticleRecord(
  registry: MulticorpusCorpusArticleRegistry,
  corpusId: string,
  articleNumber: string,
): CorpusArticleRecord | undefined {
  return registry.byCorpus.get(corpusId)?.get(articleNumber);
}
