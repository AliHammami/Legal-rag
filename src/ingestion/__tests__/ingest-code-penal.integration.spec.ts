import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { ingestCodePenal } from '../ingest-code-penal.js';
import type { PenalCodeIngestionResult } from '../types.js';

const PDF_PATH = resolve('data/code-penal-13-09-2026.pdf');
const OUTPUT_PATH = resolve('data/processed/code-penal.integration.articles.json');

describe('ingestCodePenal (PDF réel)', () => {
  let result: PenalCodeIngestionResult;

  beforeAll(async () => {
    result = await ingestCodePenal({ pdfPath: PDF_PATH, outputPath: OUTPUT_PATH });
  }, 120_000);

  it('produit 1301 articles', async () => {
    expect(result.stats.articleCount).toBe(1301);
    expect(result.stats.uniqueArticleCount).toBe(1301);

    const written = JSON.parse(
      await readFile(OUTPUT_PATH, 'utf-8'),
    ) as PenalCodeIngestionResult;
    expect(written.articles.length).toBe(1301);
  }, 120_000);

  it('article 111-1 : court, contenu attendu', () => {
    const article = result.articles.find((a) => a.articleNumber === '111-1');
    expect(article).toBeDefined();
    expect(article!.content).toContain('infractions pénales');
    expect(article!.content).toContain('crimes, délits et contraventions');
    expect(article!.content).not.toContain('Dernière modification');
  });

  it('article 113-2-1 : format à trois segments', () => {
    const article = result.articles.find((a) => a.articleNumber === '113-2-1');
    expect(article).toBeDefined();
  });

  it('article R131-1 : format réglementaire', () => {
    const article = result.articles.find((a) => a.articleNumber === 'R131-1');
    expect(article).toBeDefined();
    expect(article!.content.length).toBeGreaterThan(0);
  });

  it('article 224-1 A : suffixe alphabétique', () => {
    const article = result.articles.find((a) => a.articleNumber === '224-1 A');
    expect(article).toBeDefined();
    expect(article!.content.length).toBeGreaterThan(0);
  });

  it('article 112-2 : listes numérotées', () => {
    const article = result.articles.find((a) => a.articleNumber === '112-2');
    expect(article).toBeDefined();
    expect(article!.content).toMatch(/1°/);
  });

  it('aucun article ne contient le pied de page Légifrance', () => {
    for (const article of result.articles) {
      expect(article.content).not.toContain('Dernière modification');
      expect(article.content).not.toContain('Document généré');
    }
  });

  it('aucun article ne contient de form feed', () => {
    for (const article of result.articles) {
      expect(article.content).not.toContain('\f');
    }
  });

  it('métadonnées article sans dates document', () => {
    const article = result.articles[0]!;
    expect(article.metadata).not.toHaveProperty('lastModified');
    expect(article.metadata).not.toHaveProperty('generatedAt');
  });

  it('dates document dans le rapport, pas dans les articles', () => {
    expect(result.report?.lastModified).toBeDefined();
    expect(result.report?.generatedAt).toBeDefined();
  });
});
