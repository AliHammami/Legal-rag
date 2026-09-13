import type {
  PenalCodeArticle,
  PenalCodeArticleMetadata,
} from './types.js';

/**
 * Formats observés dans le PDF :
 * - 111-1, 113-2-1, 131-36-12-1 (législatif)
 * - 224-1 A (suffixe alphabétique)
 * - R131-1 (partie réglementaire)
 * - D712-9 (décret)
 */
export const ARTICLE_LINE_REGEX =
  /^Article ((?:[RD]?\d+(?:-\d+)+(?: [A-Z])?))\s*$/;

export const PARTIE_LINE_REGEX = /^Partie (?:législative|réglementaire)/;
export const LIVRE_LINE_REGEX = /^Livre /;
export const TITRE_LINE_REGEX = /^Titre /;
export const CHAPITRE_LINE_REGEX = /^Chapitre /;
export const SECTION_LINE_REGEX = /^Section \d+/;

export interface PageLine {
  line: string;
  pageNumber: number;
}

export interface HierarchyContext {
  partie?: string;
  livre?: string;
  titre?: string;
  chapitre?: string;
  section?: string;
}

export interface ParseStructureOptions {
  sourceFile: string;
}

interface ArticleDraft {
  articleNumber: string;
  contentLines: string[];
  pageStart: number;
  pageEnd: number;
  metadata: Omit<
    PenalCodeArticleMetadata,
    'articleNumber' | 'pageStart' | 'pageEnd' | 'source' | 'sourceType'
  >;
}

function isStructuralLine(line: string): boolean {
  return (
    PARTIE_LINE_REGEX.test(line) ||
    LIVRE_LINE_REGEX.test(line) ||
    TITRE_LINE_REGEX.test(line) ||
    CHAPITRE_LINE_REGEX.test(line) ||
    SECTION_LINE_REGEX.test(line) ||
    ARTICLE_LINE_REGEX.test(line)
  );
}

function flushArticle(
  draft: ArticleDraft | null,
  articles: PenalCodeArticle[],
  sourceFile: string,
): ArticleDraft | null {
  if (!draft) {
    return null;
  }

  const content = draft.contentLines.join('\n').trim();
  articles.push({
    articleNumber: draft.articleNumber,
    content,
    metadata: {
      articleNumber: draft.articleNumber,
      ...draft.metadata,
      pageStart: draft.pageStart,
      pageEnd: draft.pageEnd,
      source: sourceFile,
      sourceType: 'pdf',
    },
  });

  return null;
}

export function parseStructure(
  pageLines: PageLine[],
  options: ParseStructureOptions,
): PenalCodeArticle[] {
  const articles: PenalCodeArticle[] = [];
  const context: HierarchyContext = {};
  let current: ArticleDraft | null = null;

  for (const { line, pageNumber } of pageLines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (current) {
        current.contentLines.push('');
        current.pageEnd = pageNumber;
      }
      continue;
    }

    if (PARTIE_LINE_REGEX.test(trimmed)) {
      current = flushArticle(current, articles, options.sourceFile);
      context.partie = trimmed;
      continue;
    }

    if (LIVRE_LINE_REGEX.test(trimmed)) {
      current = flushArticle(current, articles, options.sourceFile);
      context.livre = trimmed;
      continue;
    }

    if (TITRE_LINE_REGEX.test(trimmed)) {
      current = flushArticle(current, articles, options.sourceFile);
      context.titre = trimmed;
      continue;
    }

    if (CHAPITRE_LINE_REGEX.test(trimmed)) {
      current = flushArticle(current, articles, options.sourceFile);
      context.chapitre = trimmed;
      continue;
    }

    if (SECTION_LINE_REGEX.test(trimmed)) {
      current = flushArticle(current, articles, options.sourceFile);
      context.section = trimmed;
      continue;
    }

    const articleMatch = trimmed.match(ARTICLE_LINE_REGEX);
    if (articleMatch) {
      current = flushArticle(current, articles, options.sourceFile);
      current = {
        articleNumber: articleMatch[1]!,
        contentLines: [],
        pageStart: pageNumber,
        pageEnd: pageNumber,
        metadata: { ...context },
      };
      continue;
    }

    if (current) {
      current.contentLines.push(trimmed);
      current.pageEnd = pageNumber;
    }
  }

  flushArticle(current, articles, options.sourceFile);
  return articles;
}

export function pageLinesFromCleanedPages(
  cleanedPages: Array<{ pageNumber: number; text: string }>,
): PageLine[] {
  const result: PageLine[] = [];
  for (const page of cleanedPages) {
    for (const line of page.text.split('\n')) {
      result.push({ line, pageNumber: page.pageNumber });
    }
  }
  return result;
}

export { isStructuralLine };
