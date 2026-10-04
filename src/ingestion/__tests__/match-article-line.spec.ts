import { describe, expect, it } from 'vitest';
import {
  matchExtendedArticleLine,
  matchPenalArticleLine,
} from '../match-article-line.js';

describe('matchPenalArticleLine', () => {
  it('accepte 111-1', () => {
    expect(matchPenalArticleLine('Article 111-1')?.rawArticleNumber).toBe(
      '111-1',
    );
  });

  it('accepte R131-1', () => {
    expect(matchPenalArticleLine('Article R131-1')?.rawArticleNumber).toBe(
      'R131-1',
    );
  });
});

describe('matchExtendedArticleLine', () => {
  it('accepte Code civil Article 1', () => {
    expect(matchExtendedArticleLine('Article 1')?.rawArticleNumber).toBe('1');
  });

  it('accepte Code du travail L1', () => {
    expect(matchExtendedArticleLine('Article L1')?.rawArticleNumber).toBe('L1');
  });

  it('accepte R* abrog?', () => {
    expect(matchExtendedArticleLine('Article R*1233-3-4')?.articleKind).toBe(
      'abrogated',
    );
  });

  it('accepte A821-94 commerce', () => {
    expect(matchExtendedArticleLine('Article A821-94')?.rawArticleNumber).toBe(
      'A821-94',
    );
  });

  it('accepte Annexe 4-7', () => {
    expect(matchExtendedArticleLine('Article Annexe 4-7')?.articleKind).toBe(
      'annexe',
    );
  });

  it('accepte suffixe -A monétaire', () => {
    expect(matchExtendedArticleLine('Article L312-1-1-A')?.rawArticleNumber).toBe(
      'L312-1-1-A',
    );
  });

  it('accepte suffixe espace -B monétaire', () => {
    expect(matchExtendedArticleLine('Article L312-1-1 B')?.rawArticleNumber).toBe(
      'L312-1-1 B',
    );
  });

  it('accepte Article liminaire consommation', () => {
    expect(matchExtendedArticleLine('Article liminaire')?.articleKind).toBe(
      'liminaire',
    );
  });

  it('rejette index éditorial', () => {
    expect(
      matchExtendedArticleLine(
        "Article L. 410-1 l'ordonnance n — 2021-649 du 26 mai 2021",
      ),
    ).toBeNull();
  });
});
