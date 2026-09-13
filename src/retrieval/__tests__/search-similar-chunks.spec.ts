import { describe, expect, it, vi } from 'vitest';
import { EMBEDDING_DIMENSIONS } from '../../embeddings/constants.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import { searchSimilarChunks } from '../search-similar-chunks.js';
import type { SimilarChunkRow } from '../types.js';

function queryVector(): number[] {
  return Array.from({ length: EMBEDDING_DIMENSIONS }, (_, i) => i * 0.0001);
}

function makeRow(chunkId: string, distance: number): SimilarChunkRow {
  return {
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
  it('calls $queryRawUnsafe with parameterized vector and topK', async () => {
    const mockRows = [
      makeRow('a#0', 0.05),
      makeRow('b#0', 0.1),
      makeRow('c#0', 0.3),
    ];

    const queryRawUnsafe = vi.fn().mockResolvedValue(mockRows);
    const prisma = { $queryRawUnsafe: queryRawUnsafe } as unknown as PrismaService;

    const results = await searchSimilarChunks(prisma, queryVector(), 3);

    expect(queryRawUnsafe).toHaveBeenCalledTimes(1);

    const [sql, vectorLiteral, topK] = queryRawUnsafe.mock.calls[0] as [
      string,
      string,
      number,
    ];

    expect(sql).toContain('embedding <=> $1::vector(3072)');
    expect(sql).toContain('LIMIT $2');
    expect(sql).not.toContain('[');
    expect(vectorLiteral).toMatch(/^\[[\d.,-]+\]$/);
    expect(topK).toBe(3);

    expect(results.map((r) => r.distance)).toEqual([0.05, 0.1, 0.3]);
    expect(results.map((r) => r.chunkId)).toEqual(['a#0', 'b#0', 'c#0']);
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
});
