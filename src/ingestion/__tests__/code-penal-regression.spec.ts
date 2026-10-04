import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ingestCodePenal } from '../ingest-code-penal.js';
import type { PenalCodeIngestionResult } from '../types.js';

const BASELINE_PATH = resolve('data/processed/code-penal.articles.json');
const PDF_PATH = resolve('data/code-penal-13-09-2026.pdf');

describe('Code pénal — régression ingestion', () => {
  it('produit exactement 1301 articles identiques au baseline', async () => {
    const baseline = JSON.parse(
      readFileSync(BASELINE_PATH, 'utf-8'),
    ) as PenalCodeIngestionResult;

    const result = await ingestCodePenal({
      pdfPath: PDF_PATH,
      outputPath: resolve('data/processed/code-penal.regression.articles.json'),
    });

    expect(result.stats.articleCount).toBe(1301);
    expect(result.stats.uniqueArticleCount).toBe(1301);
    expect(result.stats.duplicateCount).toBe(0);
    expect(result.stats.footerPollutionArticles).toBe(0);

    const baselineByNumber = new Map(
      baseline.articles.map((a) => [a.articleNumber, a]),
    );

    expect(result.articles).toHaveLength(baseline.articles.length);

    for (const article of result.articles) {
      const expected = baselineByNumber.get(article.articleNumber);
      expect(expected, `article ${article.articleNumber} manquant`).toBeDefined();
      expect(article.content).toBe(expected!.content);
      expect(article.metadata.partie).toBe(expected!.metadata.partie);
      expect(article.metadata.livre).toBe(expected!.metadata.livre);
      expect(article.metadata.titre).toBe(expected!.metadata.titre);
      expect(article.metadata.chapitre).toBe(expected!.metadata.chapitre);
      expect(article.metadata.section).toBe(expected!.metadata.section);
    }
  }, 120_000);
});
