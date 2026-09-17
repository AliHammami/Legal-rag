import { createReadStream } from 'node:fs';

import type { CorpusEmbeddedChunk } from '../embeddings/types.js';

const RECORDS_KEY = '"records"';

function findRecordsArrayStart(buffer: string): number {
  let searchFrom = 0;
  while (searchFrom < buffer.length) {
    const keyIndex = buffer.indexOf(RECORDS_KEY, searchFrom);
    if (keyIndex === -1) {
      return -1;
    }

    let index = keyIndex + RECORDS_KEY.length;
    while (index < buffer.length && /\s/.test(buffer[index]!)) {
      index++;
    }
    if (index >= buffer.length || buffer[index] !== ':') {
      searchFrom = keyIndex + 1;
      continue;
    }
    index++;
    while (index < buffer.length && /\s/.test(buffer[index]!)) {
      index++;
    }
    if (index >= buffer.length || buffer[index] !== '[') {
      searchFrom = keyIndex + 1;
      continue;
    }
    return index + 1;
  }
  return -1;
}

/**
 * Lit les records sans charger tout le JSON en memoire (gros corpus).
 */
export async function* streamEmbeddingRecords(
  embeddingsPath: string,
): AsyncGenerator<CorpusEmbeddedChunk> {
  const stream = createReadStream(embeddingsPath, {
    encoding: 'utf-8',
    highWaterMark: 512 * 1024,
  });

  let buffer = '';
  let scanIndex = 0;
  let inRecordsArray = false;
  let arrayDepth = 0;
  let objectDepth = 0;
  let inString = false;
  let escapeNext = false;
  let recordStart = -1;

  for await (const chunk of stream) {
    buffer += chunk;

    if (!inRecordsArray) {
      const arrayStart = findRecordsArrayStart(buffer);
      if (arrayStart === -1) {
        buffer = buffer.slice(-(RECORDS_KEY.length + 16));
        scanIndex = 0;
        continue;
      }
      buffer = buffer.slice(arrayStart);
      scanIndex = 0;
      inRecordsArray = true;
      arrayDepth = 1;
    }

    while (scanIndex < buffer.length) {
      const char = buffer[scanIndex]!;

      if (escapeNext) {
        escapeNext = false;
        scanIndex++;
        continue;
      }

      if (char === '\\' && inString) {
        escapeNext = true;
        scanIndex++;
        continue;
      }

      if (char === '"') {
        inString = !inString;
        scanIndex++;
        continue;
      }

      if (inString) {
        scanIndex++;
        continue;
      }

      if (char === '[') {
        arrayDepth++;
        scanIndex++;
        continue;
      }

      if (char === ']') {
        arrayDepth--;
        if (arrayDepth === 0 && objectDepth === 0) {
          return;
        }
        scanIndex++;
        continue;
      }

      if (char === '{') {
        if (objectDepth === 0 && arrayDepth === 1) {
          recordStart = scanIndex;
        }
        objectDepth++;
        scanIndex++;
        continue;
      }

      if (char === '}') {
        objectDepth--;
        if (objectDepth === 0 && recordStart >= 0) {
          const recordJson = buffer.slice(recordStart, scanIndex + 1);
          yield JSON.parse(recordJson) as CorpusEmbeddedChunk;
          buffer = buffer.slice(scanIndex + 1);
          scanIndex = 0;
          recordStart = -1;
          continue;
        }
        scanIndex++;
        continue;
      }

      scanIndex++;
    }

    if (recordStart >= 0) {
      buffer = buffer.slice(recordStart);
      scanIndex -= recordStart;
      recordStart = 0;
    }
  }
}
