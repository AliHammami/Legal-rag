import { ARTICLE_LINE_REGEX } from './parse-structure.js';
import type { ArticleKind } from './normalize-article-id.js';
import { isEditorialArticleLine } from './normalize-article-id.js';

export interface ArticleLineMatch {
  rawArticleNumber: string;
  articleKind: ArticleKind;
}

const EXTENDED_ARTICLE_PATTERNS: Array<{
  regex: RegExp;
  kind: ArticleKind;
}> = [
  { regex: /^Article liminaire\s*$/i, kind: 'liminaire' },
  {
    regex: /^Article (Annexe \u00E0 l'article .+)$/i,
    kind: 'annexe',
  },
  { regex: /^Article (Annexe [IVXLC\d-]+)$/i, kind: 'annexe' },
  { regex: /^Article (R\*[\d-]+(?:-\d+)*)$/i, kind: 'abrogated' },
  { regex: /^Article (A\d+(?:-\d+)*)$/i, kind: 'standard' },
  {
    regex: /^Article ([LRDA]\*?\d+(?:-\d+)*(?: [A-Z]|-[A-Z])*)$/i,
    kind: 'standard',
  },
  { regex: /^Article (L\d{1,2})$/i, kind: 'standard' },
  { regex: /^Article ((?:[RD]?\d+(?:-\d+)+(?: [A-Z])?))$/, kind: 'standard' },
  { regex: /^Article (\d+(?:-\d+)*)$/, kind: 'standard' },
];

export function matchPenalArticleLine(line: string): ArticleLineMatch | null {
  const trimmed = line.trim();
  const match = trimmed.match(ARTICLE_LINE_REGEX);
  if (!match) {
    return null;
  }
  return {
    rawArticleNumber: match[1]!,
    articleKind: 'standard',
  };
}

export function matchExtendedArticleLine(line: string): ArticleLineMatch | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith('Article ')) {
    return null;
  }
  if (isEditorialArticleLine(trimmed)) {
    return null;
  }

  for (const { regex, kind } of EXTENDED_ARTICLE_PATTERNS) {
    if (kind === 'liminaire' && regex.test(trimmed)) {
      return { rawArticleNumber: 'liminaire', articleKind: 'liminaire' };
    }
    const match = trimmed.match(regex);
    if (match) {
      return {
        rawArticleNumber: match[1] ?? 'liminaire',
        articleKind: kind,
      };
    }
  }

  return null;
}

export function createArticleLineMatcher(usePenalMatcher: boolean) {
  return usePenalMatcher ? matchPenalArticleLine : matchExtendedArticleLine;
}
