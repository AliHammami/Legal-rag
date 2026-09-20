import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EMBEDDING_DIMENSIONS } from '../../embeddings/constants.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import {
  computePerCorpusQuota,
  dedupeSimilarChunks,
  mergeCorpusQuotaCandidates,
  searchSimilarChunksWithCorpusQuota,
  shouldUseCorpusQuotaRetrieval,
} from '../corpus-quota-retrieval.js';
import type { SimilarChunk } from '../types.js';

const { searchSimilarChunksMock } = vi.hoisted(() => ({
  searchSimilarChunksMock: vi.fn(),
}));

vi.mock('../search-similar-chunks.js', () => ({
  searchSimilarChunks: searchSimilarChunksMock,
}));

function queryVector(): number[] {
  return Array.from({ length: EMBEDDING_DIMENSIONS }, (_, index) => index * 0.0001);
}

function makeChunk(
  chunkId: string,
  distance: number,
  corpusId: string,
): SimilarChunk {
  const articleNumber = chunkId.split('#')[0] ?? chunkId;
  return {
    corpusId,
    chunkId,
    articleNumber,
    content: `Content for ${chunkId}`,
    metadata: {
      articleNumber,
      pageStart: 1,
      pageEnd: 1,
      source: `${corpusId}.pdf`,
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

describe('corpus quota retrieval helpers', () => {
  it('computes per-corpus quota with ceil(globalTopK / n)', () => {
    expect(computePerCorpusQuota(20, 1)).toBe(20);
    expect(computePerCorpusQuota(20, 2)).toBe(10);
    expect(computePerCorpusQuota(20, 3)).toBe(7);
  });

  it('deduplicates by chunkId without dropping distinct chunks from the same corpus', () => {
    const chunks = [
      makeChunk('a#0', 0.1, 'code-civil'),
      makeChunk('a#0', 0.2, 'code-civil'),
      makeChunk('b#0', 0.3, 'code-civil'),
    ];

    expect(dedupeSimilarChunks(chunks).map((chunk) => chunk.chunkId)).toEqual([
      'a#0',
      'b#0',
    ]);
  });

  it('caps merged candidates globally by distance without corpus bias', () => {
    const merged = mergeCorpusQuotaCandidates(
      [
        makeChunk('a#0', 0.5, 'code-civil'),
        makeChunk('b#0', 0.1, 'code-du-travail'),
        makeChunk('c#0', 0.2, 'code-penal'),
      ],
      2,
    );

    expect(merged.map((chunk) => chunk.chunkId)).toEqual(['b#0', 'c#0']);
  });

  it('detects when quota retrieval should be used', () => {
    expect(shouldUseCorpusQuotaRetrieval(undefined)).toBe(false);
    expect(shouldUseCorpusQuotaRetrieval(['code-civil'])).toBe(false);
    expect(
      shouldUseCorpusQuotaRetrieval(['code-civil', 'code-du-travail']),
    ).toBe(true);
  });
});

describe('searchSimilarChunksWithCorpusQuota', () => {
  const prisma = {} as PrismaService;
  const embedding = queryVector();

  beforeEach(() => {
    searchSimilarChunksMock.mockReset();
  });

  it('retrieves top-10 per corpus for two corpora and returns 20 candidates', async () => {
    searchSimilarChunksMock.mockImplementation(
      async (_prisma, _embedding, topK, options) => {
        const corpusId = options?.corpusIds?.[0];
        if (corpusId === 'code-civil') {
          return Array.from({ length: topK }, (_, index) =>
            makeChunk(`c-${index}#0`, 0.1 + index * 0.01, 'code-civil'),
          );
        }
        return Array.from({ length: topK }, (_, index) =>
          makeChunk(`t-${index}#0`, 0.2 + index * 0.01, 'code-du-travail'),
        );
      },
    );

    const results = await searchSimilarChunksWithCorpusQuota(
      prisma,
      embedding,
      20,
      ['code-civil', 'code-du-travail'],
    );

    expect(searchSimilarChunksMock).toHaveBeenCalledTimes(2);
    expect(searchSimilarChunksMock.mock.calls[0]?.[1]).toBe(embedding);
    expect(searchSimilarChunksMock.mock.calls[1]?.[1]).toBe(embedding);
    expect(searchSimilarChunksMock.mock.calls[0]?.[2]).toBe(10);
    expect(searchSimilarChunksMock.mock.calls[1]?.[2]).toBe(10);
    expect(results).toHaveLength(20);
    expect(new Set(results.map((chunk) => chunk.corpusId)).size).toBe(2);
  });

  it('does not pad a sparse corpus with results from another corpus', async () => {
    searchSimilarChunksMock.mockImplementation(
      async (_prisma, _embedding, topK, options) => {
        const corpusId = options?.corpusIds?.[0];
        if (corpusId === 'code-civil') {
          return Array.from({ length: topK }, (_, index) =>
            makeChunk(`c-${index}#0`, 0.05 + index * 0.01, 'code-civil'),
          );
        }
        return [makeChunk('t-0#0', 0.4, 'code-du-travail')];
      },
    );

    const results = await searchSimilarChunksWithCorpusQuota(
      prisma,
      embedding,
      20,
      ['code-civil', 'code-du-travail'],
    );

    expect(results).toHaveLength(11);
    expect(results.filter((chunk) => chunk.corpusId === 'code-civil')).toHaveLength(
      10,
    );
    expect(
      results.filter((chunk) => chunk.corpusId === 'code-du-travail'),
    ).toHaveLength(1);
  });

  it('caps three-corpus quota results to the global topK by distance', async () => {
    searchSimilarChunksMock.mockImplementation(
      async (_prisma, _embedding, topK, options) => {
        const corpusId = options?.corpusIds?.[0];
        return Array.from({ length: topK }, (_, index) =>
          makeChunk(`${corpusId}-${index}#0`, 0.1 * index + 0.05, corpusId!),
        );
      },
    );

    const results = await searchSimilarChunksWithCorpusQuota(
      prisma,
      embedding,
      20,
      ['code-civil', 'code-du-travail', 'code-penal'],
    );

    expect(searchSimilarChunksMock).toHaveBeenCalledTimes(3);
    expect(searchSimilarChunksMock.mock.calls.every((call) => call[2] === 7)).toBe(
      true,
    );
    expect(results).toHaveLength(20);
    expect(results[0]?.distance).toBeLessThanOrEqual(results.at(-1)!.distance);
  });
});
