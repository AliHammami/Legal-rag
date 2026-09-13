/** Pied de page Légifrance répété sur chaque page du PDF. */
export const LEGIFRANCE_FOOTER_REGEX =
  /Code pénal\s*-\s*Dernière modification le \d{1,2} \S+ \d{4} - Document généré le \d{1,2} \S+ \d{4}\n?/g;

/** Extrait les dates du pied de page (métadonnées document, pas article). */
export const LEGIFRANCE_FOOTER_DATES_REGEX =
  /Dernière modification le (\d{1,2} \S+ \d{4}).*Document généré le (\d{1,2} \S+ \d{4})/;

/**
 * Césure de fin de ligne : lettre minuscule, tiret, saut de ligne, lettre minuscule.
 * Ne touche pas aux numéros d'articles ni aux tirets juridiques intra-ligne.
 */
export const HYPHENATION_LINE_BREAK_REGEX =
  /([a-zàâäéèêëïîôùûüç])-\n([a-zàâäéèêëïîôùûüç])/gi;

export interface CleanPageResult {
  text: string;
  warnings: string[];
}

export function cleanPageText(raw: string): CleanPageResult {
  const warnings: string[] = [];
  let text = raw;

  text = text.replace(LEGIFRANCE_FOOTER_REGEX, '');
  text = text.replace(/\f/g, '\n');
  text = text.normalize('NFC');
  text = text.replace(/[\u00A0\u202F]/g, ' ');

  if (text.includes('\uFFFD')) {
    warnings.push('replacement_character_detected');
  }

  text = text
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n');

  text = fixHyphenationLineBreaks(text);

  return { text, warnings };
}

export function fixHyphenationLineBreaks(text: string): string {
  return text.replace(HYPHENATION_LINE_BREAK_REGEX, '$1$2');
}

export function extractFooterDates(
  rawPageText: string,
): { lastModified?: string; generatedAt?: string } {
  const match = rawPageText.match(LEGIFRANCE_FOOTER_DATES_REGEX);
  if (!match) {
    return {};
  }
  return {
    lastModified: match[1],
    generatedAt: match[2],
  };
}

export function isBlankPage(text: string, minChars = 10): boolean {
  return text.replace(/\s/g, '').length < minChars;
}
