import { describe, expect, it, vi } from 'vitest';
import { EMBEDDING_DIMENSIONS } from '../../embeddings/constants.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import { searchSimilarChunks } from '../search-similar-chunks.js';
import type { SimilarChunkRow } from '../types.js';

function queryVector(): number[] {
  return Array.from({ length: EMBEDDING_DIMENSIONS }, (_, i) => i * 0.0001);
}

function makeRow(
  chunkId: string,
  distance: number,
  corpusId = 'code-penal',
): SimilarChunkRow {
  return {
    corpus_id: corpusId,
    chunk_id: chunkId,
    article_number: chunkId.split('#')[0] ?? chunkId,
    content: `Content for ${chunkId}`,
    metadata: {
      articleNumber: chunkId.split('#')[0] ?? chunkId,
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
    distance,
  };
}

describe('searchSimilarChunks', () => {
  it('searches all corpora when corpusIds is absent', async () => {
    const mockRows = [makeRow('a#0', 0.05, 'code-civil')];
    const queryRawUnsafe = vi.fn().mockResolvedValue(mockRows);
    const prisma = { $queryRawUnsafe: queryRawUnsafe } as unknown as PrismaService;

    const results = await searchSimilarChunks(prisma, queryVector(), 3);

    const [sql, vectorLiteral, topK] = queryRawUnsafe.mock.calls[0] as [
      string,
      string,
      number,
    ];

    expect(sql).toContain('corpus_id');
    expect(sql).not.toContain('WHERE corpus_id');
    expect(sql).toContain('ORDER BY embedding <=> $1::vector(3072) ASC');
    expect(sql).toContain('LIMIT $2');
    expect(vectorLiteral).toMatch(/^\[[\d.,-]+\]$/);
    expect(topK).toBe(3);
    expect(results[0]?.corpusId).toBe('code-civil');
  });

  it('filters on a single corpus with WHERE corpus_id = $3', async () => {
    const queryRawUnsafe = vi.fn().mockResolvedValue([makeRow('a#0', 0.05)]);
    const prisma = { $queryRawUnsafe: queryRawUnsafe } as unknown as PrismaService;

    await searchSimilarChunks(prisma, queryVector(), 3, {
      corpusIds: ['code-penal'],
    });

    const [sql, , , corpusId] = queryRawUnsafe.mock.calls[0] as [
      string,
      string,
      number,
      string,
    ];

    expect(sql).toContain('WHERE corpus_id = $3');
    expect(corpusId).toBe('code-penal');
  });

  it('filters on multiple corpora with ANY($3::text[])', async () => {
    const queryRawUnsafe = vi.fn().mockResolvedValue([]);
    const prisma = { $queryRawUnsafe: queryRawUnsafe } as unknown as PrismaService;

    await searchSimilarChunks(prisma, queryVector(), 20, {
      corpusIds: ['code-civil', 'code-du-travail'],
    });

    const [sql, , topK, corpusIds] = queryRawUnsafe.mock.calls[0] as [
      string,
      string,
      number,
      string[],
    ];

    expect(sql).toContain('WHERE corpus_id = ANY($3::text[])');
    expect(topK).toBe(20);
    expect(corpusIds).toEqual(['code-civil', 'code-du-travail']);
  });

  it('rejects invalid topK before querying', async () => {
    const queryRawUnsafe = vi.fn();
    const prisma = { $queryRawUnsafe: queryRawUnsafe } as unknown as PrismaService;

    await expect(searchSimilarChunks(prisma, queryVector(), 0)).rejects.toThrow();
    expect(queryRawUnsafe).not.toHaveBeenCalled();
  });

  it('rejects invalid embedding before querying', async () => {
    const queryRawUnsafe = vi.fn();
    const prisma = { $queryRawUnsafe: queryRawUnsafe } as unknown as PrismaService;

    await expect(
      searchSimilarChunks(prisma, [0.1, 0.2], 3),
    ).rejects.toThrow();
    expect(queryRawUnsafe).not.toHaveBeenCalled();
  });

  it('rejects unknown corpus before querying', async () => {
    const queryRawUnsafe = vi.fn();
    const prisma = { $queryRawUnsafe: queryRawUnsafe } as unknown as PrismaService;

    await expect(
      searchSimilarChunks(prisma, queryVector(), 3, {
        corpusIds: ['corpus-inconnu'],
      }),
    ).rejects.toThrow(/Corpus inconnu/);
    expect(queryRawUnsafe).not.toHaveBeenCalled();
  });
});
