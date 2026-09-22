import type { PenalCodeChunkMetadata } from '../../chunking/types.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import { computePerCorpusQuota } from '../corpus-quota-retrieval.js';
import type { SimilarChunk } from '../types.js';
import { buildBm25Index, scoreBm25, type Bm25Index } from './bm25-score.js';

interface CachedCorpusBm25 {
  index: Bm25Index;
  chunksById: Map<
    string,
    {
      corpusId: string;
      chunkId: string;
      articleNumber: string;
      content: string;
      metadata: PenalCodeChunkMetadata;
    }
  >;
}

const corpusCache = new Map<string, CachedCorpusBm25>();

export function clearCorpusBm25CacheForTests(): void {
  corpusCache.clear();
}

async function loadCorpusBm25Cache(
  prisma: PrismaService,
  corpusId: string,
): Promise<CachedCorpusBm25> {
  const cached = corpusCache.get(corpusId);
  if (cached) {
    return cached;
  }

  const rows = await prisma.legalCodeChunk.findMany({
    where: { corpusId },
    select: {
      corpusId: true,
      chunkId: true,
      articleNumber: true,
      content: true,
      metadata: true,
    },
  });

  const chunksById = new Map<
    string,
    CachedCorpusBm25['chunksById'] extends Map<string, infer V> ? V : never
  >();
  const documents: Array<{ id: string; text: string }> = [];

  for (const row of rows) {
    chunksById.set(row.chunkId, {
      corpusId: row.corpusId,
      chunkId: row.chunkId,
      articleNumber: row.articleNumber,
      content: row.content,
      metadata: row.metadata as unknown as PenalCodeChunkMetadata,
    });
    documents.push({ id: row.chunkId, text: row.content });
  }

  const entry: CachedCorpusBm25 = {
    index: buildBm25Index(documents),
    chunksById,
  };
  corpusCache.set(corpusId, entry);
  return entry;
}

function scoredToSimilarChunk(
  corpusId: string,
  chunkId: string,
  score: number,
  lookup: CachedCorpusBm25,
): SimilarChunk | null {
  const row = lookup.chunksById.get(chunkId);
  if (!row) {
    return null;
  }
  return {
    corpusId,
    chunkId: row.chunkId,
    articleNumber: row.articleNumber,
    content: row.content,
    metadata: row.metadata,
    distance: -score,
  };
}

export async function retrieveBm25SimilarChunks(input: {
  prisma: PrismaService;
  question: string;
  routedCorpusIds: string[];
  topK: number;
}): Promise<SimilarChunk[]> {
  const { prisma, question, routedCorpusIds, topK } = input;
  if (routedCorpusIds.length === 0) {
    return [];
  }

  if (routedCorpusIds.length === 1) {
    const corpusId = routedCorpusIds[0]!;
    const cache = await loadCorpusBm25Cache(prisma, corpusId);
    const scored = scoreBm25(cache.index, question).slice(0, topK);
    const chunks: SimilarChunk[] = [];
    for (const entry of scored) {
      const chunk = scoredToSimilarChunk(corpusId, entry.id, entry.score, cache);
      if (chunk) {
        chunks.push(chunk);
      }
    }
    return chunks;
  }

  const perCorpusFetch = computePerCorpusQuota(topK, routedCorpusIds.length);
  const merged: SimilarChunk[] = [];
  for (const corpusId of routedCorpusIds) {
    const cache = await loadCorpusBm25Cache(prisma, corpusId);
    const scored = scoreBm25(cache.index, question).slice(0, perCorpusFetch);
    for (const entry of scored) {
      const chunk = scoredToSimilarChunk(corpusId, entry.id, entry.score, cache);
      if (chunk) {
        merged.push(chunk);
      }
    }
  }

  merged.sort((left, right) => left.distance - right.distance);
  return merged.slice(0, topK);
}
