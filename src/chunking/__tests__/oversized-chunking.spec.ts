import { describe, expect, it } from 'vitest';
import { MAX_SIZE } from '../constants.js';
import { chunkArticle } from '../group-chunks.js';
import type { PenalCodeArticle } from '../../ingestion/types.js';

function makeArticle(content: string, articleNumber: string): PenalCodeArticle {
  return {
    articleNumber,
    content,
    metadata: {
      articleNumber,
      pageStart: 1,
      pageEnd: 10,
      source: 'test.pdf',
      sourceType: 'pdf',
      isOversized: content.length >= 10_000,
      contentLength: content.length,
    },
  };
}

describe('chunking articles oversized', () => {
  it('découpe un article simul? de 156k caractères sans dépasser MAX_SIZE', () => {
    const paragraph = 'I.-Les dispositions applicables. '.repeat(20);
    const content = Array.from({ length: 8000 }, (_, i) => `${i + 1}— ${paragraph}`).join('\n\n');
    expect(content.length).toBeGreaterThan(100_000);

    const article = makeArticle(content, 'R4314-17-sim');
    const chunks = chunkArticle(article);

    expect(chunks.length).toBeGreaterThan(50);
    for (const chunk of chunks) {
      expect(chunk.charCount).toBeLessThanOrEqual(MAX_SIZE);
    }
    expect(chunks.every((c) => c.articleNumber === 'R4314-17-sim')).toBe(true);
  });
});
