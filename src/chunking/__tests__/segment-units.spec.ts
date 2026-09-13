import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { segmentUnits } from '../segment-units.js';

const ARTICLES_PATH = resolve('data/processed/code-penal.articles.json');

function articleContent(num: string): string {
  const data = JSON.parse(readFileSync(ARTICLES_PATH, 'utf-8')) as {
    articles: Array<{ articleNumber: string; content: string }>;
  };
  const article = data.articles.find((a) => a.articleNumber === num);
  if (!article) {
    throw new Error(`Article ${num} not found`);
  }
  return article.content;
}

describe('segmentUnits', () => {
  it('121-3 produit 5 unités juridiques', () => {
    const units = segmentUnits(articleContent('121-3'));
    expect(units).toHaveLength(5);
    expect(units[0]!.text).toMatch(/intention de le commettre/);
    expect(units[2]!.text).toMatch(/faute d'imprudence/);
    expect(units[2]!.text).toMatch(/disposait\./);
    expect(units[4]!.text).toMatch(/force majeure/);
  });

  it('121-3 fusionne les repliures L3-L6 et L7-L12', () => {
    const units = segmentUnits(articleContent('121-3'));
    expect(units[2]!.text).not.toContain('\n');
    expect(units[3]!.text).not.toContain('\n');
    expect(units[2]!.text.length).toBeGreaterThan(400);
    expect(units[3]!.text.length).toBeGreaterThan(500);
  });

  it('112-2 produit intro + items de liste', () => {
    const units = segmentUnits(articleContent('112-2'));
    expect(units[0]!.type).toBe('paragraph');
    expect(units.filter((u) => u.type === 'list-item').length).toBe(4);
    expect(units[1]!.text).toMatch(/^1°/);
    expect(units[4]!.text).toMatch(/^4°/);
  });

  it('reconnaît 5° bis et 12° bis comme items de liste', () => {
    const units = segmentUnits(articleContent('131-6'));
    const bisItems = units.filter((u) => /\d+°\s+bis/i.test(u.text));
    expect(bisItems.length).toBeGreaterThanOrEqual(2);
    expect(bisItems.some((u) => u.text.startsWith('5° bis'))).toBe(true);
    expect(bisItems.some((u) => u.text.startsWith('12° bis'))).toBe(true);
  });

  it('traite \\n\\n comme frontière dure entre blocs', () => {
    const units = segmentUnits(articleContent('131-6'));
    const last = units[units.length - 1]!;
    expect(last.type).toBe('paragraph');
    expect(last.text).toMatch(/6°, 7°, 10°/);
  });

  it('reconnaît les sections romaines', () => {
    const content = 'I.-Premier bloc.\n\nII.-Deuxième bloc.';
    const units = segmentUnits(content);
    expect(units).toHaveLength(2);
    expect(units[0]!.type).toBe('roman-section');
    expect(units[1]!.type).toBe('roman-section');
  });

  it('reconnaît les sous-items alphabétiques', () => {
    const content = 'Intro:\na) premier;\nb) second.';
    const units = segmentUnits(content);
    expect(units.filter((u) => u.type === 'alpha-item')).toHaveLength(2);
  });
});
