import { describe, expect, it } from 'vitest';
import type { SimilarChunk } from '../../retrieval/types.js';
import { buildRagContext } from '../build-rag-context.js';

function makeChunk(
  chunkId: string,
  articleNumber: string,
  chunkIndex: number,
  content: string,
  options: {
    corpusId?: string;
    codeName?: string;
    distance?: number;
    rerankScore?: number;
  } = {},
): SimilarChunk & { rerankScore: number } {
  const corpusId = options.corpusId ?? 'code-penal';
  const codeName = options.codeName ?? 'Code pénal';

  return {
    corpusId,
    chunkId,
    articleNumber,
    content,
    distance: options.distance ?? 0.42,
    rerankScore: options.rerankScore ?? 0.91,
    metadata: {
      articleNumber,
      corpusId,
      codeName,
      pageStart: 1,
      pageEnd: 1,
      source: `data/${corpusId}.pdf`,
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

  it('formats a single chunk with stable sourceId and code name', () => {
    const chunk = makeChunk('122-5#0', '122-5', 0, 'Texte article 122-5');
    const result = buildRagContext([chunk]);

    expect(result.sources).toHaveLength(1);
    expect(result.sources[0]).toMatchObject({
      sourceId: 1,
      chunkId: '122-5#0',
      codeName: 'Code pénal',
      articleNumber: '122-5',
      chunkIndex: 0,
      content: 'Texte article 122-5',
      chunk,
    });
    expect(result.context).toBe(
      '[Source 1 — Code pénal — Article 122-5 — chunk 0]\nTexte article 122-5',
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
    expect(result.context).toContain(
      '[Source 1 — Code pénal — Article 122-6 — chunk 0]',
    );
    expect(result.context).toContain(
      '[Source 2 — Code pénal — Article 122-5 — chunk 0]',
    );
  });

  it('includes corpus code name in headers for multicorpus context', () => {
    const chunks = [
      makeChunk('L322-2#0', 'L322-2', 0, 'Texte consommation', {
        corpusId: 'code-de-la-consommation',
        codeName: 'Code de la consommation',
      }),
      makeChunk('L123-4#0', 'L123-4', 0, 'Texte monétaire', {
        corpusId: 'code-monetaire-et-financier',
        codeName: 'Code monétaire et financier',
      }),
    ];
    const result = buildRagContext(chunks);

    expect(result.context).toContain(
      '[Source 1 — Code de la consommation — Article L322-2 — chunk 0]',
    );
    expect(result.context).toContain('Texte consommation');
    expect(result.context).toContain(
      '[Source 2 — Code monétaire et financier — Article L123-4 — chunk 0]',
    );
    expect(result.context).toContain('Texte monétaire');
  });

  it('falls back to corpusId when codeName metadata is absent', () => {
    const chunk = makeChunk('122-5#0', '122-5', 0, 'Texte article', {
      codeName: undefined,
    });
    chunk.metadata.codeName = undefined;

    const result = buildRagContext([chunk]);

    expect(result.sources[0]?.codeName).toBe('code-penal');
    expect(result.context).toContain(
      '[Source 1 — code-penal — Article 122-5 — chunk 0]',
    );
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
