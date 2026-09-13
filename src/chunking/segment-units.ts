import type { LegalUnit, LegalUnitType } from './types.js';

export const LIST_ITEM_REGEX = /^\d+°(?:\s+bis)?/i;
export const ROMAN_SECTION_REGEX = /^[IVXLC]+\.-/;
export const ALPHA_ITEM_REGEX = /^[a-z]\)/;
export const SENTENCE_END_REGEX = /[.;:?!»]$/;
export const CONTINUATION_REGEX = /^[a-zàâäéèêëïîôùûüç('"«(]/;
export const UPPERCASE_START_REGEX = /^[A-ZÀÂÄÉÈÊËÏÎÔÙÛÜÇT]/;

export function isStrongBoundary(line: string): boolean {
  const trimmed = line.trim();
  return (
    LIST_ITEM_REGEX.test(trimmed) ||
    ROMAN_SECTION_REGEX.test(trimmed) ||
    ALPHA_ITEM_REGEX.test(trimmed)
  );
}

export function classifyUnit(text: string): LegalUnitType {
  if (LIST_ITEM_REGEX.test(text)) {
    return 'list-item';
  }
  if (ROMAN_SECTION_REGEX.test(text)) {
    return 'roman-section';
  }
  if (ALPHA_ITEM_REGEX.test(text)) {
    return 'alpha-item';
  }
  return 'paragraph';
}

function mergeLinesInBlock(lines: string[]): string[] {
  const units: string[] = [];
  let current = '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    if (!current) {
      current = trimmed;
      continue;
    }

    if (isStrongBoundary(trimmed)) {
      units.push(current);
      current = trimmed;
      continue;
    }

    const currentEndsSentence = SENTENCE_END_REGEX.test(current.trim());
    const isContinuation = CONTINUATION_REGEX.test(trimmed);

    if (
      currentEndsSentence &&
      !isContinuation &&
      UPPERCASE_START_REGEX.test(trimmed)
    ) {
      units.push(current);
      current = trimmed;
    } else {
      current += ' ' + trimmed;
    }
  }

  if (current) {
    units.push(current);
  }

  return units;
}

export function segmentUnits(content: string): LegalUnit[] {
  const blocks = content.split(/\n\n+/);
  const unitTexts: string[] = [];

  for (const block of blocks) {
    unitTexts.push(...mergeLinesInBlock(block.split('\n')));
  }

  return unitTexts.map((text, index) => ({
    index,
    type: classifyUnit(text),
    text,
  }));
}
