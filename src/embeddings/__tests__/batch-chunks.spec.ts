import { describe, expect, it } from 'vitest';
import { buildBatches } from '../batch-chunks.js';
import type { PenalCodeChunk } from '../../chunking/types.js';

function makeChunk(id: string): PenalCodeChunk {
  return {
    chunkId: id,
    articleNumber: id.split('#')[0]!,
    content: `content-${id}`,
    charCount: 10,
    metadata: {
      articleNumber: id.split('#')[0]!,
      pageStart: 1,
      pageEnd: 1,
      source: 'data/code-penal.pdf',
      sourceType: 'pdf',
      chunkIndex: 0,
      chunkCount: 1,
      unitStart: 0,
      unitEnd: 0,
      unitCount: 1,
    },
  };
}

describe('buildBatches', () => {
  it('découpe 1368 chunks en 11 batches de 128', () => {
    const chunks = Array.from({ length: 1368 }, (_, i) => makeChunk(`A#${i}`));
    const batches = buildBatches(chunks, 128);
    expect(batches).toHaveLength(11);
    expect(batches[0]).toHaveLength(128);
    expect(batches[10]).toHaveLength(1368 - 128 * 10);
  });

  it('préserve l\'ordre des chunks', () => {
    const chunks = [makeChunk('1#0'), makeChunk('2#0'), makeChunk('3#0')];
    const batches = buildBatches(chunks, 2);
    expect(batches[0]!.map((c) => c.chunkId)).toEqual(['1#0', '2#0']);
    expect(batches[1]!.map((c) => c.chunkId)).toEqual(['3#0']);
  });
});
