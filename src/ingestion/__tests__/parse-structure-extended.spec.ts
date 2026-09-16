import { describe, expect, it } from 'vitest';
import { parseStructure, type PageLine } from '../parse-structure.js';

describe('parseStructure (corpus ?tendu)', () => {
  it('parse Code civil Article 1', () => {
    const lines: PageLine[] = [
      { line: 'Article 1', pageNumber: 1 },
      { line: 'Les lois entrent en vigueur.', pageNumber: 1 },
    ];
    const articles = parseStructure(lines, {
      sourceFile: 'code-civil.pdf',
      corpusId: 'code-civil',
      usePenalArticleMatcher: false,
    });
    expect(articles).toHaveLength(1);
    expect(articles[0]!.articleNumber).toBe('1');
  });

  it('parse Code du travail L1', () => {
    const lines: PageLine[] = [
      { line: 'Partie l\u00E9gislative', pageNumber: 1 },
      { line: 'Article L1', pageNumber: 1 },
      { line: 'Tout projet de r\u00E9forme envisag\u00E9.', pageNumber: 1 },
    ];
    const articles = parseStructure(lines, {
      sourceFile: 'code-travail.pdf',
      usePenalArticleMatcher: false,
    });
    expect(articles[0]!.articleNumber).toBe('L1');
    expect(articles[0]!.metadata.partie).toBe('Partie l\u00E9gislative');
  });

  it('hi?rarchie insensible ? la casse (LIVRE)', () => {
    const lines: PageLine[] = [
      { line: 'LIVRE Ier : Du commerce', pageNumber: 1 },
      { line: 'Article L110-1', pageNumber: 1 },
      { line: 'La loi r\u00E9pute actes de commerce.', pageNumber: 1 },
    ];
    const articles = parseStructure(lines, {
      sourceFile: 'code-commerce.pdf',
      usePenalArticleMatcher: false,
    });
    expect(articles[0]!.metadata.livre).toBe('LIVRE Ier : Du commerce');
  });

  it('Partie l?gislative nouvelle', () => {
    const lines: PageLine[] = [
      { line: 'Partie l\u00E9gislative nouvelle', pageNumber: 1 },
      { line: 'Article liminaire', pageNumber: 1 },
      { line: 'D\u00E9finitions.', pageNumber: 1 },
    ];
    const articles = parseStructure(lines, {
      sourceFile: 'code-consommation.pdf',
      usePenalArticleMatcher: false,
    });
    expect(articles[0]!.articleNumber).toBe('liminaire');
    expect(articles[0]!.metadata.partie).toBe('Partie l\u00E9gislative nouvelle');
  });

  it('d?tecte les collisions d\'identifiants', () => {
    const lines: PageLine[] = [
      { line: 'Article L1234-5', pageNumber: 1 },
      { line: 'Premier texte.', pageNumber: 1 },
      { line: 'Article L1234-5', pageNumber: 2 },
      { line: 'Second texte.', pageNumber: 2 },
    ];
    const articles = parseStructure(lines, {
      sourceFile: 'test.pdf',
      usePenalArticleMatcher: false,
    });
    expect(articles).toHaveLength(2);
    expect(articles[0]!.articleNumber).toBe('L1234-5');
    expect(articles[1]!.articleNumber).toBe('L1234-5@p2');
  });

  it('ignore une section absorb?e comme article', () => {
    const lines: PageLine[] = [
      { line: 'Article D314-17', pageNumber: 1 },
      { line: 'Section 2 : Regroupement de cr\u00E9dits', pageNumber: 1 },
    ];
    const articles = parseStructure(lines, {
      sourceFile: 'code-consommation.pdf',
      usePenalArticleMatcher: false,
    });
    expect(articles).toHaveLength(0);
  });
});
