import type { ArticleLineMatch } from './match-article-line.js';
import { createArticleLineMatcher } from './match-article-line.js';
import {
  normalizeExtendedArticleId,
  normalizePenalArticleId,
  resolveDuplicateArticleNumber,
  type ArticleKind,
} from './normalize-article-id.js';
import type {
  PenalCodeArticle,
  PenalCodeArticleMetadata,
} from './types.js';

/**
 * Formats observés dans le PDF Code pénal :
 * - 111-1, 113-2-1, 131-36-12-1 (législatif)
 * - 224-1 A (suffixe alphabétique)
 * - R131-1 (partie réglementaire)
 * - D712-9 (décret)
 */
export const ARTICLE_LINE_REGEX =
  /^Article ((?:[RD]?\d+(?:-\d+)+(?: [A-Z])?))\s*$/;

export const PARTIE_LINE_REGEX =
  /^Partie (?:l\u00E9gislative(?:\s+nouvelle)?|r\u00E9glementaire)/i;
export const LIVRE_LINE_REGEX = /^Livre /i;
export const TITRE_LINE_REGEX = /^Titre /i;
export const CHAPITRE_LINE_REGEX = /^Chapitre /i;
export const SECTION_LINE_REGEX = /^Section \d+/i;

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
  corpusId?: string;
  usePenalArticleMatcher?: boolean;
}

export interface ParseStructureStats {
  droppedEmptyArticles: number;
  droppedSectionOnlyArticles: number;
  duplicateWarnings: string[];
}

interface ArticleDraft {
  articleNumber: string;
  rawArticleNumber: string;
  articleKind: ArticleKind;
  contentLines: string[];
  pageStart: number;
  pageEnd: number;
  metadata: Omit<
    PenalCodeArticleMetadata,
    'articleNumber' | 'pageStart' | 'pageEnd' | 'source' | 'sourceType'
  >;
}

function isStructuralLine(
  line: string,
  matchArticle: (line: string) => ArticleLineMatch | null,
): boolean {
  return (
    PARTIE_LINE_REGEX.test(line) ||
    LIVRE_LINE_REGEX.test(line) ||
    TITRE_LINE_REGEX.test(line) ||
    CHAPITRE_LINE_REGEX.test(line) ||
    SECTION_LINE_REGEX.test(line) ||
    matchArticle(line) !== null
  );
}

function shouldDropArticle(content: string): 'empty' | 'section-only' | null {
  const trimmed = content.trim();
  if (trimmed.length === 0) {
    return 'empty';
  }
  if (
    /^Section \d+ :/.test(trimmed) &&
    trimmed.length < 120 &&
    !trimmed.includes('\n\n')
  ) {
    return 'section-only';
  }
  return null;
}

function flushArticle(
  draft: ArticleDraft | null,
  articles: PenalCodeArticle[],
  sourceFile: string,
  stats: ParseStructureStats,
): ArticleDraft | null {
  if (!draft) {
    return null;
  }

  const content = draft.contentLines.join('\n').trim();
  const dropReason = shouldDropArticle(content);
  if (dropReason === 'empty') {
    stats.droppedEmptyArticles++;
    return null;
  }
  if (dropReason === 'section-only') {
    stats.droppedSectionOnlyArticles++;
    return null;
  }

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
      corpusId: draft.metadata.corpusId,
      codeName: draft.metadata.codeName,
      rawArticleNumber: draft.rawArticleNumber,
      articleKind: draft.articleKind,
    },
  });

  return null;
}

export function parseStructure(
  pageLines: PageLine[],
  options: ParseStructureOptions,
): PenalCodeArticle[] {
  const usePenal = options.usePenalArticleMatcher ?? true;
  const matchArticle = createArticleLineMatcher(usePenal);
  const normalizeId = usePenal
    ? (raw: string, _kind: ArticleKind) => normalizePenalArticleId(raw)
    : normalizeExtendedArticleId;

  const articles: PenalCodeArticle[] = [];
  const stats: ParseStructureStats = {
    droppedEmptyArticles: 0,
    droppedSectionOnlyArticles: 0,
    duplicateWarnings: [],
  };
  const idOccurrences = new Map<string, number>();
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
      current = flushArticle(current, articles, options.sourceFile, stats);
      context.partie = trimmed;
      continue;
    }

    if (LIVRE_LINE_REGEX.test(trimmed)) {
      current = flushArticle(current, articles, options.sourceFile, stats);
      context.livre = trimmed;
      continue;
    }

    if (TITRE_LINE_REGEX.test(trimmed)) {
      current = flushArticle(current, articles, options.sourceFile, stats);
      context.titre = trimmed;
      continue;
    }

    if (CHAPITRE_LINE_REGEX.test(trimmed)) {
      current = flushArticle(current, articles, options.sourceFile, stats);
      context.chapitre = trimmed;
      continue;
    }

    if (SECTION_LINE_REGEX.test(trimmed)) {
      current = flushArticle(current, articles, options.sourceFile, stats);
      context.section = trimmed;
      continue;
    }

    const articleMatch = matchArticle(trimmed);
    if (articleMatch) {
      current = flushArticle(current, articles, options.sourceFile, stats);

      const normalized = normalizeId(
        articleMatch.rawArticleNumber,
        articleMatch.articleKind,
      );
      const occurrence = (idOccurrences.get(normalized) ?? 0) + 1;
      idOccurrences.set(normalized, occurrence);

      const articleNumber = resolveDuplicateArticleNumber(
        normalized,
        occurrence,
        pageNumber,
      );

      if (occurrence > 1) {
        stats.duplicateWarnings.push(
          `Identifiant dupliqué "${normalized}" → "${articleNumber}" (occurrence ${occurrence}, page ${pageNumber})`,
        );
      }

      current = {
        articleNumber,
        rawArticleNumber: articleMatch.rawArticleNumber,
        articleKind: articleMatch.articleKind,
        contentLines: [],
        pageStart: pageNumber,
        pageEnd: pageNumber,
        metadata: {
          ...context,
          corpusId: options.corpusId,
          codeName: undefined,
        },
      };
      continue;
    }

    if (current) {
      current.contentLines.push(trimmed);
      current.pageEnd = pageNumber;
    }
  }

  flushArticle(current, articles, options.sourceFile, stats);

  (parseStructure as { lastStats?: ParseStructureStats }).lastStats = stats;

  return articles;
}

export function getLastParseStructureStats(): ParseStructureStats | undefined {
  return (parseStructure as { lastStats?: ParseStructureStats }).lastStats;
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
