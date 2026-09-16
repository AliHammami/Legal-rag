import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { ALL_CORPUS_IDS, getCorpusConfig } from '../../ingestion/corpus-config.js';
import type { PenalCodeChunkingResult } from '../types.js';
import { findDuplicateChunkIds } from '../validate-chunk-ids.js';

describe('chunkId uniqueness across corpora', () => {
  it.each(ALL_CORPUS_IDS)(
    'all chunkId values are unique in %s',
    async (corpusId) => {
      const config = getCorpusConfig(corpusId);
      const raw = await readFile(resolve(config.chunksOutputPath), 'utf-8');
      const chunking = JSON.parse(raw) as PenalCodeChunkingResult;

      expect(findDuplicateChunkIds(chunking.chunks)).toEqual([]);
    },
  );
});
