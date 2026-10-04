import { describe, expect, it } from 'vitest';

import type { PenalCodeChunk } from '../../chunking/types.js';
import {
  analyzeCorpusChunks,
  countTokens,
  createEmbeddingTokenizer,
} from '../chunk-token-analyzer.js';
import { EvaluationError } from '../evaluation.error.js';

function makeChunk(
  overrides: Partial<PenalCodeChunk> & Pick<PenalCodeChunk, 'chunkId' | 'content'>,
): PenalCodeChunk {
  return {
    articleNumber: overrides.articleNumber ?? '111-1',
    charCount: overrides.content.length,
    metadata: {
      articleNumber: overrides.articleNumber ?? '111-1',
      pageStart: 1,
      pageEnd: 1,
      source: 'test.pdf',
      sourceType: 'pdf',
      chunkIndex: 0,
      chunkCount: 1,
      unitStart: 0,
      unitEnd: 0,
      unitCount: 1,
      ...(overrides.metadata ?? {}),
    },
    ...overrides,
  };
}

describe('chunk-token-analyzer', () => {
  const tokenizer = createEmbeddingTokenizer();

  it('tokenise un contenu non vide', () => {
    const tokenCount = countTokens(tokenizer, 'Les infractions pénales sont classées.');
    expect(tokenCount).toBeGreaterThan(0);
  });

  it('analyse un corpus minimal', () => {
    const chunks = [
      makeChunk({
        chunkId: '111-1#0',
        content: 'Les infractions pénales sont classées.',
      }),
      makeChunk({
        chunkId: '111-2#0',
        content: 'La loi détermine les crimes et délits.',
        charCount: 999,
      }),
    ];

    const analysis = analyzeCorpusChunks(
      { id: 'code-penal', codeName: 'Code pénal', path: 'test.json' },
      chunks,
      tokenizer,
    );

    expect(analysis.chunkCount).toBe(2);
    expect(analysis.tokens.max).toBeGreaterThan(0);
    expect(analysis.charCountMismatches).toBe(1);
    expect(analysis.anomalies.some((a) => a.type === 'char_count_mismatch')).toBe(
      true,
    );
  });

  it('signale les chunkId dupliques sans bloquer l analyse', () => {
    const chunks = [
      makeChunk({ chunkId: '111-1#0', content: 'Premier chunk.' }),
      makeChunk({ chunkId: '111-1#0', content: 'Second chunk.' }),
    ];

    const analysis = analyzeCorpusChunks(
      { id: 'code-penal', codeName: 'Code penal', path: 'test.json' },
      chunks,
      tokenizer,
    );

    expect(analysis.duplicateChunkIds).toBe(1);
    expect(analysis.anomalies.some((a) => a.type === 'duplicate_chunk_id')).toBe(
      true,
    );
  });

  it('rejette un contenu vide', () => {
    const chunks = [makeChunk({ chunkId: '111-1#0', content: '' })];

    expect(() =>
      analyzeCorpusChunks(
        { id: 'code-penal', codeName: 'Code pénal', path: 'test.json' },
        chunks,
        tokenizer,
      ),
    ).toThrow(EvaluationError);
  });
});
