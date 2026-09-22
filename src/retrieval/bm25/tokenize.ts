const FRENCH_STOP = new Set([
  'le',
  'la',
  'les',
  'de',
  'du',
  'des',
  'un',
  'une',
  'et',
  'ou',
  'en',
  'au',
  'aux',
  'par',
  'pour',
  'dans',
  'sur',
  'que',
  'qui',
  'qu',
  'est',
  'sont',
  'ce',
  'cette',
  'ses',
  'son',
  'sa',
  'their',
  'the',
  'a',
]);

export function normalizeFrenchText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

export function tokenizeForLexical(text: string): string[] {
  const normalized = normalizeFrenchText(text);
  const raw = normalized.match(/[\p{L}\p{N}][\p{L}\p{N}-]*/gu) ?? [];
  return raw.filter((token) => token.length > 1 && !FRENCH_STOP.has(token));
}
