import { computePerCorpusQuota } from '../../retrieval/corpus-quota-retrieval.js';
import { loadCorpusArticleChunks } from './retrieval-diagnostic.js';
import type { RankedRetrievalChunk } from './retrieval-depth-benchmark.js';
import {
  buildBm25Index,
  scoreBm25,
} from './semantic-diagnostic-lexical.js';

interface ScoredChunk {
  corpusId: string;
  articleNumber: string;
  chunkId: string;
  score: number;
}

async function scoreCorpusChunks(
  corpusId: string,
  question: string,
): Promise<ScoredChunk[]> {
  const byArticle = await loadCorpusArticleChunks(corpusId);
  const documents: Array<{ id: string; text: string; articleNumber: string }> =
    [];
  for (const [articleNumber, chunks] of byArticle.entries()) {
    for (const chunk of chunks) {
      documents.push({
        id: chunk.chunkId,
        text: chunk.content,
        articleNumber,
      });
    }
  }
  const index = buildBm25Index(
    documents.map((doc) => ({ id: doc.id, text: doc.text })),
  );
  const scored = scoreBm25(index, question);
  return scored.map((entry) => {
    const doc = documents.find((item) => item.id === entry.id);
    return {
      corpusId,
      articleNumber: doc?.articleNumber ?? entry.id.split('#')[0] ?? entry.id,
      chunkId: entry.id,
      score: entry.score,
    };
  });
}

export async function retrieveBm25QuotaAtK(input: {
  question: string;
  routedCorpusIds: string[];
  k: number;
}): Promise<RankedRetrievalChunk[]> {
  const { question, routedCorpusIds, k } = input;
  if (routedCorpusIds.length === 0) {
    return [];
  }

  if (routedCorpusIds.length === 1) {
    const scored = await scoreCorpusChunks(routedCorpusIds[0]!, question);
    return scored.slice(0, k).map((chunk, index) => ({
      corpusId: chunk.corpusId,
      articleNumber: chunk.articleNumber,
      chunkId: chunk.chunkId,
      rank: index + 1,
      distance: -chunk.score,
    }));
  }

  const perCorpusFetch = computePerCorpusQuota(k, routedCorpusIds.length);
  const merged: ScoredChunk[] = [];
  for (const corpusId of routedCorpusIds) {
    const scored = await scoreCorpusChunks(corpusId, question);
    merged.push(...scored.slice(0, perCorpusFetch));
  }

  merged.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }
    return left.chunkId.localeCompare(right.chunkId);
  });

  return merged.slice(0, k).map((chunk, index) => ({
    corpusId: chunk.corpusId,
    articleNumber: chunk.articleNumber,
    chunkId: chunk.chunkId,
    rank: index + 1,
    distance: -chunk.score,
  }));
}
