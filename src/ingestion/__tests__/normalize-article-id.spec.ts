import { describe, expect, it } from 'vitest';
import {
  assertUniqueArticleNumbers,
  findDuplicateArticleNumbers,
  isEditorialArticleLine,
  normalizeExtendedArticleId,
  normalizePenalArticleId,
  resolveDuplicateArticleNumber,
} from '../normalize-article-id.js';

describe('normalizePenalArticleId', () => {
  it('conserve le suffixe avec espace (224-1 A)', () => {
    expect(normalizePenalArticleId('224-1 A')).toBe('224-1 A');
  });
});

describe('normalizeExtendedArticleId', () => {
  it('normalise L910-1 A en L910-1-A', () => {
    expect(normalizeExtendedArticleId('L910-1 A', 'standard')).toBe('L910-1-A');
  });

  it('normalise L312-1-1 A en L312-1-1-A', () => {
    expect(normalizeExtendedArticleId('L312-1-1 A', 'standard')).toBe(
      'L312-1-1-A',
    );
  });

  it('conserve R*1233-3-4', () => {
    expect(normalizeExtendedArticleId('R*1233-3-4', 'abrogated')).toBe(
      'R*1233-3-4',
    );
  });

  it('normalise liminaire', () => {
    expect(normalizeExtendedArticleId('liminaire', 'liminaire')).toBe(
      'liminaire',
    );
  });

  it('normalise Annexe 4-7', () => {
    expect(normalizeExtendedArticleId('Annexe 4-7', 'annexe')).toBe('Annexe 4-7');
  });

  it('normalise Annexe ? l\'article D. 211-2', () => {
    expect(
      normalizeExtendedArticleId(
        "Annexe \u00E0 l'article D. 211-2 du code de la consommation",
        'annexe',
      ),
    ).toBe('annexe-D211-2');
  });
});

describe('isEditorialArticleLine', () => {
  it('rejette un index éditorial commerce', () => {
    expect(
      isEditorialArticleLine(
        "Article L. 410-1 l'ordonnance n\u00B0 2021-649 du 26 mai 2021",
      ),
    ).toBe(true);
  });

  it('accepte Article L110-1', () => {
    expect(isEditorialArticleLine('Article L110-1')).toBe(false);
  });

  it('accepte Article liminaire', () => {
    expect(isEditorialArticleLine('Article liminaire')).toBe(false);
  });
});

describe('resolveDuplicateArticleNumber', () => {
  it('conserve le premier identifiant', () => {
    expect(resolveDuplicateArticleNumber('L1234-5', 1, 100)).toBe('L1234-5');
  });

  it('suffixe les doublons avec @p{page}', () => {
    expect(resolveDuplicateArticleNumber('L1234-5', 2, 1234)).toBe(
      'L1234-5@p1234',
    );
  });

  it('suffixe la 3e occurrence sur la meme page avec @o{occurrence}', () => {
    expect(resolveDuplicateArticleNumber('2', 3, 2999, 2)).toBe('2@p2999@o3');
    expect(resolveDuplicateArticleNumber('2', 4, 2999, 3)).toBe('2@p2999@o4');
  });

  it('garde @p{page} distinct si la 3e occurrence est sur une autre page', () => {
    expect(resolveDuplicateArticleNumber('2', 3, 3000, 1)).toBe('2@p3000');
  });
});

describe('findDuplicateArticleNumbers', () => {
  it('detecte les articleNumber dupliques', () => {
    expect(findDuplicateArticleNumbers(['A', 'B', 'A'])).toEqual(['A']);
  });

  it('assertUniqueArticleNumbers echoue si des doublons existent', () => {
    expect(() =>
      assertUniqueArticleNumbers(['2@p2999', '2@p2999'], 'code-du-travail'),
    ).toThrow(/Duplicate articleNumber/);
  });
});
