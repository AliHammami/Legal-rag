import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { chunkCodePenal } from '../chunk-code-penal.js';
import { MAX_SIZE } from '../constants.js';
import { segmentUnits } from '../segment-units.js';
import type { PenalCodeChunkingResult } from '../types.js';
import type { PenalCodeIngestionResult } from '../../ingestion/types.js';

const ARTICLES_PATH = resolve('data/processed/code-penal.articles.json');
const OUTPUT_PATH = resolve('data/processed/code-penal.chunks.json');

describe('chunkCodePenal (JSON réel)', () => {
  let result: PenalCodeChunkingResult;
  let ingestion: PenalCodeIngestionResult;

  beforeAll(async () => {
    ingestion = JSON.parse(readFileSync(ARTICLES_PATH, 'utf-8'));
    result = await chunkCodePenal({
      articlesPath: ARTICLES_PATH,
      outputPath: OUTPUT_PATH,
    });
  });

  it('couvre tous les articles avec au moins un chunk', () => {
    expect(result.stats.articleCount).toBe(ingestion.articles.length);
    const chunkedArticles = new Set(result.chunks.map((c) => c.articleNumber));
    for (const article of ingestion.articles) {
      expect(chunkedArticles.has(article.articleNumber)).toBe(true);
    }
  });

  it('respecte la taille maximale et les index', () => {
    expect(result.stats.chunksOverMax).toBe(0);
    for (const chunk of result.chunks) {
      expect(chunk.charCount).toBeLessThanOrEqual(MAX_SIZE);
      expect(chunk.charCount).toBe(chunk.content.length);
      expect(chunk.metadata.chunkIndex).toBeGreaterThanOrEqual(0);
      expect(chunk.metadata.chunkIndex).toBeLessThan(chunk.metadata.chunkCount);
      expect(chunk.metadata.unitStart).toBeLessThanOrEqual(chunk.metadata.unitEnd);
      expect(chunk.metadata.unitCount).toBeGreaterThan(0);
      expect(chunk.chunkId).toBe(`${chunk.articleNumber}#${chunk.metadata.chunkIndex}`);
    }
  });

  it('articles ≤ 2000 restent verbatim dans un seul chunk', () => {
    for (const article of ingestion.articles) {
      if (article.content.length > MAX_SIZE) {
        continue;
      }
      const chunks = result.chunks.filter(
        (c) => c.articleNumber === article.articleNumber,
      );
      expect(chunks).toHaveLength(1);
      expect(chunks[0]!.content).toBe(article.content);
    }
  });

  it('articles longs : conservation complète sans duplication', () => {
    for (const article of ingestion.articles) {
      if (article.content.length <= MAX_SIZE) {
        continue;
      }
      const units = segmentUnits(article.content).map((u) => u.text);
      const chunks = result.chunks.filter(
        (c) => c.articleNumber === article.articleNumber,
      );
      expect(chunks.length).toBeGreaterThan(1);

      const parts = chunks.flatMap((c) => c.content.split('\n\n'));
      expect(parts).toHaveLength(units.length);
      expect([...parts].sort()).toEqual([...units].sort());
      expect(new Set(parts).size).toBe(parts.length);
    }
  });

  it('articleNumber juridique correct, identique à la source', () => {
    const byNumber = new Map(
      ingestion.articles.map((article) => [article.articleNumber, article]),
    );
    for (const chunk of result.chunks) {
      expect(byNumber.has(chunk.articleNumber)).toBe(true);
      expect(chunk.articleNumber).not.toContain('#');
      expect(chunk.chunkId).toBe(`${chunk.articleNumber}#${chunk.metadata.chunkIndex}`);
    }
  });

  it('conserve les métadonnées et exclut les dates document', () => {
    const sample = result.chunks.find((c) => c.articleNumber === '121-3');
    expect(sample?.metadata.partie).toBeDefined();
    expect(sample?.metadata.livre).toBeDefined();
    expect(sample?.metadata.pageStart).toBeGreaterThan(0);
    expect(sample?.metadata).not.toHaveProperty('lastModified');
    expect(sample?.metadata).not.toHaveProperty('generatedAt');
  });

  it('aucun chunk ne contient footer ou form feed', () => {
    for (const chunk of result.chunks) {
      expect(chunk.content).not.toContain('Dernière modification');
      expect(chunk.content).not.toContain('Document généré');
      expect(chunk.content).not.toContain('\f');
    }
  });

  it('articles représentatifs présents', () => {
    for (const num of ['111-1', '112-2', '121-3', '131-6', '132-45', '224-1 A', 'R131-1', 'D712-9']) {
      expect(result.chunks.some((c) => c.articleNumber === num)).toBe(true);
    }
  });
});
