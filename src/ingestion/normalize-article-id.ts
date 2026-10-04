export type ArticleKind = 'standard' | 'liminaire' | 'annexe' | 'abrogated';

export interface NormalizedArticleId {
  articleNumber: string;
  articleKind: ArticleKind;
  rawArticleNumber: string;
}

/** Index éditorial Légifrance : — Article L. 410-1 l'ordonnance n—— — */
export function isEditorialArticleLine(line: string): boolean {
  const trimmed = line.trim();
  if (!/^Article /.test(trimmed)) {
    return false;
  }
  if (/^Article liminaire\s*$/i.test(trimmed)) {
    return false;
  }
  if (/^Article Annexe/i.test(trimmed)) {
    return false;
  }

  const body = trimmed.slice('Article '.length).trim();
  if (
    /^[LRDA]\.\s+\d/.test(body) &&
    /(?:ordonnance|loi n\u00B0|D\u00E9cret|d\u00E9cret)/i.test(body)
  ) {
    return true;
  }
  if (/\d[\d.-]*\s+(?:l'ordonnance|la loi|le d\u00E9cret)/i.test(body)) {
    return true;
  }
  return false;
}

/**
 * Normalisation étendue pour les corpus hors Code pénal.
 * Déterministe ; les suffixes alphabétiques — A — deviennent — -A —.
 */
export function normalizeExtendedArticleId(
  rawId: string,
  articleKind: ArticleKind,
): string {
  const trimmed = rawId.trim();

  if (articleKind === 'liminaire') {
    return 'liminaire';
  }

  if (articleKind === 'annexe') {
    return normalizeAnnexeId(trimmed);
  }

  let id = trimmed;

  if (articleKind === 'abrogated') {
    return id.replace(/\s+/g, '');
  }

  id = id.replace(/(\d) ([A-Z])$/, '$1-$2');
  id = id.replace(/\s+/g, '');
  return id;
}

function normalizeQuotes(value: string): string {
  return value.replace(/[\u2018\u2019']/g, "'");
}

function normalizeAnnexeId(raw: string): string {
  const normalized = normalizeQuotes(raw);
  const refMatch = normalized.match(
    /^Annexe \u00E0 l'article ([A-Z])\.\s*([\d-]+)/i,
  );
  if (refMatch) {
    const prefix = refMatch[1]!.toUpperCase();
    const num = refMatch[2]!.replace(/\./g, '');
    return `annexe-${prefix}${num}`;
  }

  const shortMatch = normalized.match(/^Annexe ([IVXLC\d-]+)$/i);
  if (shortMatch) {
    return `Annexe ${shortMatch[1]}`;
  }

  return normalized
    .replace(/^Annexe \u00E0 l'article /i, 'annexe-')
    .replace(/\./g, '')
    .replace(/\s+/g, '-')
    .replace(/du-code-de-la-consommation$/i, '')
    .replace(/-+$/, '');
}

/** Normalisation legacy Code pénal : identique au parser historique (trim seulement). */
export function normalizePenalArticleId(rawId: string): string {
  return rawId.trim();
}

/**
 * D\u00E9sambigu\u00EFse les identifiants normalis\u00E9s en double.
 * Occurrence 2 : suffixe @p{page}. Si @p{page} est d\u00E9j\u00E0 pris pour ce
 * num\u00E9ro normalis\u00E9, ajoute @o{occurrence}.
 */
export function resolveDuplicateArticleNumber(
  articleNumber: string,
  occurrence: number,
  pageStart: number,
  pageAssignmentIndex = 1,
): string {
  if (occurrence <= 1) {
    return articleNumber;
  }

  const pageSuffix = `${articleNumber}@p${pageStart}`;
  if (pageAssignmentIndex === 1) {
    return pageSuffix;
  }

  return `${pageSuffix}@o${occurrence}`;
}

export function findDuplicateArticleNumbers(
  articleNumbers: readonly string[],
): string[] {
  const seen = new Map<string, number>();
  const duplicates = new Set<string>();

  for (const articleNumber of articleNumbers) {
    const count = (seen.get(articleNumber) ?? 0) + 1;
    seen.set(articleNumber, count);
    if (count > 1) {
      duplicates.add(articleNumber);
    }
  }

  return [...duplicates].sort();
}

export function assertUniqueArticleNumbers(
  articleNumbers: readonly string[],
  corpusId: string,
): void {
  const duplicates = findDuplicateArticleNumbers(articleNumbers);
  if (duplicates.length > 0) {
    throw new Error(
      `Duplicate articleNumber(s) in ${corpusId}: ${duplicates.join(', ')}`,
    );
  }
}
