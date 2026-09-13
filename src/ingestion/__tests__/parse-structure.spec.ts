import { describe, expect, it } from 'vitest';
import {
  ARTICLE_LINE_REGEX,
  parseStructure,
  type PageLine,
} from '../parse-structure.js';

describe('ARTICLE_LINE_REGEX', () => {
  it('accepte le format standard 111-1', () => {
    expect('Article 111-1'.match(ARTICLE_LINE_REGEX)?.[1]).toBe('111-1');
  });

  it('accepte le format à trois segments 113-2-1', () => {
    expect('Article 113-2-1'.match(ARTICLE_LINE_REGEX)?.[1]).toBe('113-2-1');
  });

  it('accepte le format à quatre segments 131-36-12-1', () => {
    expect('Article 131-36-12-1'.match(ARTICLE_LINE_REGEX)?.[1]).toBe(
      '131-36-12-1',
    );
  });


  it('accepte un suffixe alphabétique 224-1 A', () => {
    expect('Article 224-1 A'.match(ARTICLE_LINE_REGEX)?.[1]).toBe('224-1 A');
  });

  it('accepte un article réglementaire R131-1', () => {
    expect('Article R131-1'.match(ARTICLE_LINE_REGEX)?.[1]).toBe('R131-1');
  });

  it('accepte un article décret D712-9', () => {
    expect('Article D712-9'.match(ARTICLE_LINE_REGEX)?.[1]).toBe('D712-9');
  });

  it('rejette une ligne de contenu', () => {
    expect('Article 111-1 du code'.match(ARTICLE_LINE_REGEX)).toBeNull();
  });
});

describe('parseStructure', () => {
  const fixtureLines: PageLine[] = [
    { line: 'Partie législative', pageNumber: 1 },
    { line: 'Livre Ier : Dispositions générales', pageNumber: 1 },
    { line: 'Titre Ier : De la loi pénale', pageNumber: 1 },
    { line: 'Chapitre Ier : Des principes généraux', pageNumber: 1 },
    { line: 'Article 111-1', pageNumber: 1 },
    { line: '', pageNumber: 1 },
    { line: 'Les infractions pénales sont classées, suivant leur gravité, en crimes, délits et contraventions.', pageNumber: 1 },
    { line: 'Article 113-2-1', pageNumber: 2 },
    { line: '', pageNumber: 2 },
    { line: 'Texte de l\'article 113-2-1.', pageNumber: 2 },
  ];

  it('extrait les articles avec hiérarchie héritée', () => {
    const articles = parseStructure(fixtureLines, {
      sourceFile: 'code-penal.pdf',
    });

    expect(articles).toHaveLength(2);
    expect(articles[0]!.articleNumber).toBe('111-1');
    expect(articles[0]!.content).toContain('infractions pénales');
    expect(articles[0]!.metadata.livre).toContain('Dispositions générales');
    expect(articles[0]!.metadata.pageStart).toBe(1);

    expect(articles[1]!.articleNumber).toBe('113-2-1');
    expect(articles[1]!.metadata.pageStart).toBe(2);
  });

  it('préserve les sauts de ligne dans le contenu', () => {
    const lines: PageLine[] = [
      { line: 'Article 112-1', pageNumber: 1 },
      { line: 'Premier alinéa.', pageNumber: 1 },
      { line: '', pageNumber: 1 },
      { line: 'Deuxième alinéa.', pageNumber: 1 },
    ];
    const articles = parseStructure(lines, { sourceFile: 'code-penal.pdf' });
    expect(articles[0]!.content).toBe('Premier alinéa.\n\nDeuxième alinéa.');
  });
});
