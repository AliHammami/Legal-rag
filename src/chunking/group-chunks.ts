import type { PenalCodeArticle } from '../ingestion/types.js';
import { buildChunkFromParts } from './build-chunk.js';
import { MAX_SIZE, TARGET_SIZE, UNIT_SEPARATOR } from './constants.js';
import { segmentUnits } from './segment-units.js';
import type { LegalUnit, PenalCodeChunk, SplitLevel } from './types.js';

export interface GroupablePart {
  text: string;
  unitIndex: number;
  splitLevel: SplitLevel;
}

export function joinPartTexts(parts: GroupablePart[]): string {
  return parts.map((part) => part.text).join(UNIT_SEPARATOR);
}

export function splitOversizedUnit(
  unit: LegalUnit,
  maxSize: number,
): { parts: GroupablePart[]; splitLevel: SplitLevel } {
  if (unit.text.length <= maxSize) {
    return {
      parts: [{ text: unit.text, unitIndex: unit.index, splitLevel: 'unit' }],
      splitLevel: 'unit',
    };
  }

  const sentenceParts = splitBySentences(unit.text, maxSize);
  if (sentenceParts.every((part) => part.length <= maxSize)) {
    return {
      parts: sentenceParts.map((text) => ({
        text,
        unitIndex: unit.index,
        splitLevel: 'sentence' as const,
      })),
      splitLevel: 'sentence',
    };
  }

  const hardParts = splitByHardBoundary(unit.text, maxSize);
  return {
    parts: hardParts.map((text) => ({
      text,
      unitIndex: unit.index,
      splitLevel: 'hard' as const,
    })),
    splitLevel: 'hard',
  };
}

function splitBySentences(text: string, maxSize: number): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g) ?? [text];
  const parts: string[] = [];
  let buffer = '';

  for (const sentence of sentences) {
    const next = buffer ? buffer + sentence : sentence;
    if (next.length > maxSize && buffer.length > 0) {
      parts.push(buffer.trim());
      buffer = sentence;
    } else {
      buffer = next;
    }
  }

  if (buffer.trim()) {
    parts.push(buffer.trim());
  }

  return parts.length > 0 ? parts : [text];
}

function splitByHardBoundary(text: string, maxSize: number): string[] {
  const parts: string[] = [];
  let remaining = text;

  while (remaining.length > maxSize) {
    let splitAt = remaining.lastIndexOf(' ', maxSize);
    if (splitAt <= 0) {
      splitAt = maxSize;
    }
    parts.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }

  if (remaining) {
    parts.push(remaining);
  }

  return parts.length > 0 ? parts : [text];
}

export function expandUnitsToParts(
  units: LegalUnit[],
  maxSize: number,
): GroupablePart[] {
  const parts: GroupablePart[] = [];

  for (const unit of units) {
    const { parts: unitParts } = splitOversizedUnit(unit, maxSize);
    parts.push(...unitParts);
  }

  return parts;
}

function partSize(parts: GroupablePart[]): number {
  return joinPartTexts(parts).length;
}

function dominantSplitLevel(parts: GroupablePart[]): SplitLevel | undefined {
  if (parts.some((part) => part.splitLevel === 'hard')) {
    return 'hard';
  }
  if (parts.some((part) => part.splitLevel === 'sentence')) {
    return 'sentence';
  }
  return undefined;
}

export function groupPartsIntoChunks(
  article: PenalCodeArticle,
  parts: GroupablePart[],
  units: LegalUnit[],
  targetSize: number = TARGET_SIZE,
  maxSize: number = MAX_SIZE,
): PenalCodeChunk[] {
  const chunks: PenalCodeChunk[] = [];
  let buffer: GroupablePart[] = [];

  const flush = () => {
    if (buffer.length === 0) {
      return;
    }

    const content = joinPartTexts(buffer);
    const unitStart = Math.min(...buffer.map((part) => part.unitIndex));
    const unitEnd = Math.max(...buffer.map((part) => part.unitIndex));
    const splitLevel = dominantSplitLevel(buffer);

    chunks.push(
      buildChunkFromParts({
        article,
        content,
        chunkIndex: chunks.length,
        chunkCount: 0,
        unitStart,
        unitEnd,
        unitCount: units.length,
        splitLevel,
      }),
    );
    buffer = [];
  };

  for (const part of parts) {
    if (part.text.length > maxSize) {
      throw new Error(
        `Part exceeds max size after split for article ${article.articleNumber}`,
      );
    }

    const separatorLength = buffer.length > 0 ? UNIT_SEPARATOR.length : 0;
    const projectedSize = partSize(buffer) + separatorLength + part.text.length;

    if (projectedSize > maxSize && buffer.length > 0) {
      flush();
    }

    buffer.push(part);
  }

  flush();

  return chunks.map((chunk, index) => ({
    ...chunk,
    chunkId: `${chunk.articleNumber}#${index}`,
    metadata: {
      ...chunk.metadata,
      chunkIndex: index,
      chunkCount: chunks.length,
    },
  }));
}

export function chunkArticle(
  article: PenalCodeArticle,
  targetSize: number = TARGET_SIZE,
  maxSize: number = MAX_SIZE,
): PenalCodeChunk[] {
  if (article.content.length <= maxSize) {
    const units = segmentUnits(article.content);
    return [
      buildChunkFromParts({
        article,
        content: article.content,
        chunkIndex: 0,
        chunkCount: 1,
        unitStart: 0,
        unitEnd: Math.max(units.length - 1, 0),
        unitCount: units.length,
      }),
    ];
  }

  const units = segmentUnits(article.content);
  const parts = expandUnitsToParts(units, maxSize);
  return groupPartsIntoChunks(article, parts, units, targetSize, maxSize);
}
