import { describe, expect, it } from 'vitest';
import type { SimilarChunk } from '../../retrieval/types.js';
import { toRerankDocuments } from '../to-rerank-documents.js';

describe('toRerankDocuments', () => {
  it('maps chunks to chunkId and content only', () => {
    const chunks: SimilarChunk[] = [
      {
        chunkId: '122-5#0',
        articleNumber: '122-5',
        content: 'Texte juridique',
        metadata: {
          articleNumber: '122-5',
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
        distance: 0.42,
      },
    ];

    expect(toRerankDocuments(chunks)).toEqual([
      { chunkId: '122-5#0', content: 'Texte juridique' },
    ]);
  });
});
