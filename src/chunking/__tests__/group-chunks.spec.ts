import { describe, expect, it } from 'vitest';
import { MAX_SIZE, TARGET_SIZE } from '../constants.js';
import {
  chunkArticle,
  expandUnitsToParts,
  groupPartsIntoChunks,
  splitOversizedUnit,
} from '../group-chunks.js';
import type { LegalUnit } from '../types.js';
import type { PenalCodeArticle } from '../../ingestion/types.js';

const baseMetadata = {
  articleNumber: 'TEST-1',
  pageStart: 1,
  pageEnd: 1,
  source: 'data/code-penal.pdf',
  sourceType: 'pdf' as const,
};

function makeArticle(content: string, articleNumber = 'TEST-1'): PenalCodeArticle {
  return {
    articleNumber,
    content,
    metadata: { ...baseMetadata, articleNumber },
  };
}

describe('chunkArticle', () => {
  it('article ≤ 2000 produit un chunk verbatim', () => {
    const content = 'Premier alinéa.\nDeuxième alinéa.';
    const article = makeArticle(content);
    const chunks = chunkArticle(article);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.content).toBe(content);
    expect(chunks[0]!.charCount).toBe(content.length);
    expect(chunks[0]!.metadata.chunkIndex).toBe(0);
    expect(chunks[0]!.metadata.chunkCount).toBe(1);
  });

  it('article long produit plusieurs chunks ≤ 2000 sans duplication', () => {
    const intro = 'Introduction :';
    const items = Array.from(
      { length: 30 },
      (_, i) => `${i + 1}° Item ${i + 1} `.padEnd(120, 'x') + ';',
    );
    const content = [intro, ...items].join('\n');
    const article = makeArticle(content, 'TEST-LONG');
    expect(content.length).toBeGreaterThan(MAX_SIZE);

    const chunks = chunkArticle(article);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.charCount).toBeLessThanOrEqual(MAX_SIZE);
    }

    const parts = chunks.flatMap((chunk) => chunk.content.split('\n\n'));
    expect(parts[0]).toMatch(/^Introduction/);
    expect(parts.filter((p) => p.startsWith('1°')).length).toBe(1);
    expect(new Set(parts).size).toBe(parts.length);
  });

  it('ne reprend pas l\'introduction dans les chunks suivants', () => {
    const intro = 'Intro de liste :';
    const items = Array.from({ length: 25 }, (_, i) => {
      return `${i + 1}° Élément numéro ${i + 1} `.padEnd(100, '.') + ';';
    });
    const content = [intro, ...items].join('\n');
    const article = makeArticle(content, 'TEST-NO-INTRO-REPEAT');
    const chunks = chunkArticle(article);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]!.content).toContain('Intro de liste');
    for (const chunk of chunks.slice(1)) {
      expect(chunk.content).not.toContain('Intro de liste');
    }
  });

  it('conserve une unité entre 1500 et 2000 entière', () => {
    const bigUnit = 'A'.repeat(1800);
    const article = makeArticle(bigUnit, 'TEST-BIG-UNIT');
    const chunks = chunkArticle(article);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.content).toBe(bigUnit);
  });
});


  it('n\'effectue pas de flush automatique à TARGET_SIZE si l\'unité suivante tient dans MAX_SIZE', () => {
    const units: LegalUnit[] = [
      { index: 0, type: 'paragraph', text: 'A'.repeat(1520) },
      { index: 1, type: 'list-item', text: `${'2° '}${'B'.repeat(347)}` },
    ];
    const article = makeArticle('placeholder', 'TEST-SOFT-TARGET');
    const parts = expandUnitsToParts(units, MAX_SIZE);
    const chunks = groupPartsIntoChunks(article, parts, units, TARGET_SIZE, MAX_SIZE);

    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.charCount).toBe(1520 + 2 + 350);
    expect(chunks[0]!.charCount).toBeLessThanOrEqual(MAX_SIZE);
  });

  it('flush uniquement quand l\'unité suivante dépasserait MAX_SIZE', () => {
    const units: LegalUnit[] = [
      { index: 0, type: 'paragraph', text: 'A'.repeat(1520) },
      { index: 1, type: 'list-item', text: `${'2° '}${'B'.repeat(479)}` },
    ];
    const article = makeArticle('placeholder', 'TEST-MAX-FLUSH');
    const parts = expandUnitsToParts(units, MAX_SIZE);
    const chunks = groupPartsIntoChunks(article, parts, units, TARGET_SIZE, MAX_SIZE);

    expect(chunks).toHaveLength(2);
    expect(chunks[0]!.charCount).toBe(1520);
    expect(chunks[1]!.charCount).toBe(482);
  });

describe('splitOversizedUnit', () => {
  it('découpe une unité > 2000 en phrases puis hard split si nécessaire', () => {
    const unit: LegalUnit = {
      index: 0,
      type: 'paragraph',
      text: `${'Phrase longue. '.repeat(300)}`.trim(),
    };
    expect(unit.text.length).toBeGreaterThan(MAX_SIZE);

    const { parts, splitLevel } = splitOversizedUnit(unit, MAX_SIZE);
    expect(parts.length).toBeGreaterThan(1);
    expect(['sentence', 'hard']).toContain(splitLevel);
    for (const part of parts) {
      expect(part.text.length).toBeLessThanOrEqual(MAX_SIZE);
    }
  });
});

describe('groupPartsIntoChunks', () => {
  it('assigne des index cohérents', () => {
    const article = makeArticle('x'.repeat(5000), 'TEST-IDX');
    const units: LegalUnit[] = Array.from({ length: 10 }, (_, i) => ({
      index: i,
      type: 'list-item',
      text: `${i + 1}° ${'y'.repeat(400)}`,
    }));
    const parts = expandUnitsToParts(units, MAX_SIZE);
    const chunks = groupPartsIntoChunks(article, parts, units, TARGET_SIZE, MAX_SIZE);

    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((chunk, index) => {
      expect(chunk.metadata.chunkIndex).toBe(index);
      expect(chunk.metadata.chunkCount).toBe(chunks.length);
      expect(chunk.chunkId).toBe(`${article.articleNumber}#${index}`);
    });
  });
});
