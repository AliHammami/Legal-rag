import { describe, expect, it } from 'vitest';

import { EvaluationError } from '../evaluation.error.js';
import {
  extractE2ESourcesFromContext,
  parseContextSourceBlocks,
} from '../extract-e2e-sources-from-context.js';

const q001Context = `[Source 1 — Article 122-6 — chunk 0]
Est présumé avoir agi en état de légitime défense celui qui accomplit l'acte :
1° Pour repousser, de nuit, l'entrée par effraction, violence ou ruse dans un lieu habité ;

[Source 2 — Article 122-5 — chunk 0]
N'est pas pénalement responsable la personne qui, devant une atteinte injustifiée envers elle-même ou autrui,
accomplit, dans le même temps, un acte commandé par la nécessité de la légitime défense d'elle-même ou
d'autrui, sauf s'il y a disproportion entre les moyens de défense employés et la gravité de l'atteinte.`;

describe('parseContextSourceBlocks', () => {
  it('parses multiple source blocks from context', () => {
    const blocks = parseContextSourceBlocks(q001Context);

    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({
      sourceId: 1,
      articleNumber: '122-6',
      chunkIndex: 0,
    });
    expect(blocks[1]?.articleNumber).toBe('122-5');
  });

  it('parses article numbers with letter prefixes', () => {
    const context = `[Source 1 — Article R645-3 — chunk 0]
Contenu de l'article R645-3.`;

    expect(parseContextSourceBlocks(context)[0]?.articleNumber).toBe('R645-3');
  });
});

describe('extractE2ESourcesFromContext', () => {
  it('joins snapshot sources with parsed context content', () => {
    const sources = extractE2ESourcesFromContext(q001Context, [
      {
        sourceId: 1,
        chunkId: '122-6#0',
        articleNumber: '122-6',
        chunkIndex: 0,
      },
      {
        sourceId: 2,
        chunkId: '122-5#0',
        articleNumber: '122-5',
        chunkIndex: 0,
      },
    ]);

    expect(sources).toHaveLength(2);
    expect(sources[0]).toEqual({
      sourceId: 1,
      chunkId: '122-6#0',
      articleNumber: '122-6',
      content: expect.stringContaining('légitime défense'),
    });
  });

  it('rejects mismatched source counts', () => {
    expect(() =>
      extractE2ESourcesFromContext(q001Context, [
        {
          sourceId: 1,
          chunkId: '122-6#0',
          articleNumber: '122-6',
          chunkIndex: 0,
        },
      ]),
    ).toThrow(EvaluationError);
  });
});
