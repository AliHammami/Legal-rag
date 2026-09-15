import { describe, expect, it } from 'vitest';
import type { SimilarChunk } from '../../retrieval/types.js';
import { buildRagContext } from '../build-rag-context.js';

function makeChunk(
  chunkId: string,
  articleNumber: string,
  chunkIndex: number,
  content: string,
  distance = 0.42,
  rerankScore = 0.91,
): SimilarChunk & { rerankScore: number } {
  return {
    chunkId,
    articleNumber,
    content,
    distance,
    rerankScore,
    metadata: {
      articleNumber,
      pageStart: 1,
      pageEnd: 1,
      source: 'data/code-penal.pdf',
      sourceType: 'pdf',
      chunkIndex,
      chunkCount: 2,
      unitStart: 0,
      unitEnd: 0,
      unitCount: 1,
    },
  };
}

describe('buildRagContext', () => {
  it('returns empty context for no chunks', () => {
    const result = buildRagContext([]);
    expect(result.context).toBe('');
    expect(result.sources).toEqual([]);
  });

  it('formats a single chunk with stable sourceId', () => {
    const chunk = makeChunk('122-5#0', '122-5', 0, 'Texte article 122-5');
    const result = buildRagContext([chunk]);

    expect(result.sources).toHaveLength(1);
    expect(result.sources[0]).toMatchObject({
      sourceId: 1,
      chunkId: '122-5#0',
      articleNumber: '122-5',
      chunkIndex: 0,
      content: 'Texte article 122-5',
      chunk,
    });
    expect(result.context).toBe(
      '[Source 1 — Article 122-5 — chunk 0]\nTexte article 122-5',
    );
  });

  it('preserves source order for multiple chunks', () => {
    const chunks = [
      makeChunk('122-6#0', '122-6', 0, 'Texte 122-6'),
      makeChunk('122-5#0', '122-5', 0, 'Texte 122-5'),
    ];
    const result = buildRagContext(chunks);

    expect(result.sources.map((source) => source.sourceId)).toEqual([1, 2]);
    expect(result.sources.map((source) => source.articleNumber)).toEqual([
      '122-6',
      '122-5',
    ]);
    expect(result.context).toContain('[Source 1 — Article 122-6 — chunk 0]');
    expect(result.context).toContain('[Source 2 — Article 122-5 — chunk 0]');
  });

  it('does not include technical fields in the context string', () => {
    const result = buildRagContext([
      makeChunk('122-5#0', '122-5', 0, 'Texte article'),
    ]);

    expect(result.context).not.toContain('distance');
    expect(result.context).not.toContain('rerankScore');
    expect(result.context).not.toContain('embedding');
    expect(result.context).not.toContain('metadata');
  });
});
