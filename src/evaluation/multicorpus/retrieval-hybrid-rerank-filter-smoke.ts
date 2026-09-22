import {
  goldArticlesMatch,
  type GoldArticle,
} from '../gold-article.js';
import { buildRagContext } from '../../generation/build-rag-context.js';
import { dynamicContextFilter } from '../../generation/dynamic-context-filter.js';
import type { RerankedChunk } from '../../reranking/types.js';
import { DEFAULT_RELATIVE_SCORE_THRESHOLD } from '../../generation/constants.js';
import { rerankChunks } from '../../reranking/rerank-chunks.js';
import type { RerankerService } from '../../reranking/reranker.service.js';
import type { SimilarChunk } from '../../retrieval/types.js';
import { DEFAULT_RERANK_TOP_K } from '../../reranking/constants.js';
import type { RankedRetrievalChunk } from './retrieval-depth-benchmark.js';
import { loadCorpusArticleChunks } from './retrieval-diagnostic.js';
import { goldRecallInCandidateSet } from './retrieval-hybrid-metrics.js';

export type HybridRerankVariant = 'vector' | 'union' | 'rrf';

export interface HybridRerankFilterStageMetrics {
  goldHits: number;
  goldTotal: number;
  goldRecall: number;
  fullCoverage: boolean;
  corpusCoverage: number | null;
  corpusTotal: number | null;
  chunkCount: number;
}

export interface HybridRerankFilterVariantResult {
  variant: HybridRerankVariant;
  candidateCount: number;
  retrieval: HybridRerankFilterStageMetrics;
  afterJina: HybridRerankFilterStageMetrics;
  afterFilter: HybridRerankFilterStageMetrics;
  jinaTop5: Array<{
    rank: number;
    chunkId: string;
    corpusId: string;
    articleNumber: string;
    score: number;
  }>;
  filterRows: Array<{
    chunkId: string;
    corpusId: string;
    articleNumber: string;
    rerankScore: number;
    kept: boolean;
  }>;
  finalContextChunkIds: string[];
}

const chunkContentCache = new Map<string, PenalCodeChunkLookup>();

interface PenalCodeChunkLookup {
  content: string;
  metadata: SimilarChunk['metadata'];
}

async function getChunkLookup(
  corpusId: string,
  chunkId: string,
  articleNumber: string,
): Promise<PenalCodeChunkLookup> {
  const key = `${corpusId}::${chunkId}`;
  const cached = chunkContentCache.get(key);
  if (cached) {
    return cached;
  }
  const byArticle = await loadCorpusArticleChunks(corpusId);
  const chunks = byArticle.get(articleNumber) ?? [];
  const found = chunks.find((chunk) => chunk.chunkId === chunkId);
  if (!found) {
    throw new Error(`Missing chunk ${corpusId}/${chunkId}`);
  }
  const lookup = {
    content: found.content,
    metadata: found.metadata,
  };
  chunkContentCache.set(key, lookup);
  return lookup;
}

export async function hydrateRankedAsSimilar(
  rows: RankedRetrievalChunk[],
): Promise<SimilarChunk[]> {
  const hydrated: SimilarChunk[] = [];
  for (const row of rows) {
    const lookup = await getChunkLookup(
      row.corpusId,
      row.chunkId,
      row.articleNumber,
    );
    hydrated.push({
      corpusId: row.corpusId,
      chunkId: row.chunkId,
      articleNumber: row.articleNumber,
      content: lookup.content,
      metadata: lookup.metadata,
      distance: row.distance ?? 0,
    });
  }
  return hydrated;
}

function stageMetrics(input: {
  goldArticles: GoldArticle[];
  goldCorpusIds: string[];
  questionType: string;
  chunks: Array<{ corpusId: string; articleNumber: string; chunkId?: string }>;
}): HybridRerankFilterStageMetrics {
  const recall = goldRecallInCandidateSet(
    input.goldArticles,
    input.chunks.map((chunk, index) => ({
      corpusId: chunk.corpusId,
      articleNumber: chunk.articleNumber,
      chunkId: chunk.chunkId ?? `${chunk.articleNumber}#0`,
      rank: index + 1,
    })),
  );
  const fullCoverage = input.goldArticles.every((gold) =>
    input.chunks.some((chunk) => goldArticlesMatch(gold, chunk)),
  );
  let corpusCoverage: number | null = null;
  let corpusTotal: number | null = null;
  if (input.questionType === 'multi-corpus') {
    const hitCorpora = new Set(
      input.goldArticles
        .filter((gold) =>
          input.chunks.some((chunk) => goldArticlesMatch(gold, chunk)),
        )
        .map((gold) => gold.corpusId),
    );
    corpusCoverage = input.goldCorpusIds.filter((corpusId) =>
      hitCorpora.has(corpusId),
    ).length;
    corpusTotal = input.goldCorpusIds.length;
  }
  return {
    goldHits: recall.hits,
    goldTotal: recall.total,
    goldRecall: recall.recall,
    fullCoverage,
    corpusCoverage,
    corpusTotal,
    chunkCount: input.chunks.length,
  };
}

export async function runHybridRerankFilterVariant(input: {
  variant: HybridRerankVariant;
  question: string;
  questionType: string;
  goldArticles: GoldArticle[];
  goldCorpusIds: string[];
  routedCorpusIds: string[];
  candidates: RankedRetrievalChunk[];
  rerankerService: RerankerService;
}): Promise<HybridRerankFilterVariantResult> {
  const similar = await hydrateRankedAsSimilar(input.candidates);
  const retrieval = stageMetrics({
    goldArticles: input.goldArticles,
    goldCorpusIds: input.goldCorpusIds,
    questionType: input.questionType,
    chunks: similar,
  });

  const reranked = await rerankChunks(
    input.rerankerService,
    input.question,
    similar,
    DEFAULT_RERANK_TOP_K,
  );

  const afterJina = stageMetrics({
    goldArticles: input.goldArticles,
    goldCorpusIds: input.goldCorpusIds,
    questionType: input.questionType,
    chunks: reranked,
  });

  const filterCorpusIds =
    input.routedCorpusIds.length > 1 ? input.routedCorpusIds : undefined;
  const filtered = dynamicContextFilter(reranked, {
    relativeScoreThreshold: DEFAULT_RELATIVE_SCORE_THRESHOLD,
    routedCorpusIds: filterCorpusIds,
  });

  const afterFilter = stageMetrics({
    goldArticles: input.goldArticles,
    goldCorpusIds: input.goldCorpusIds,
    questionType: input.questionType,
    chunks: filtered,
  });

  const keptIds = new Set(filtered.map((chunk) => chunk.chunkId));
  const bestScore = reranked[0]?.rerankScore ?? 0;

  return {
    variant: input.variant,
    candidateCount: input.candidates.length,
    retrieval,
    afterJina,
    afterFilter,
    jinaTop5: reranked.map((chunk, index) => ({
      rank: index + 1,
      chunkId: chunk.chunkId,
      corpusId: chunk.corpusId,
      articleNumber: chunk.articleNumber,
      score: chunk.rerankScore ?? 0,
    })),
    filterRows: reranked.map((chunk) => ({
      chunkId: chunk.chunkId,
      corpusId: chunk.corpusId,
      articleNumber: chunk.articleNumber,
      rerankScore: chunk.rerankScore ?? 0,
      kept: keptIds.has(chunk.chunkId),
    })),
    finalContextChunkIds: filtered.map((chunk) => chunk.chunkId),
  };
}

export function aggregateHybridVariantMetrics(
  results: HybridRerankFilterVariantResult[],
): {
  avgRetrievalRecall: number;
  avgJinaRecall: number;
  avgFilterRecall: number;
  fullCoverageRate: number;
  corpusCoverageRate: number;
  avgFilterChunks: number;
} {
  let goldHitsRetrieval = 0;
  let goldHitsJina = 0;
  let goldHitsFilter = 0;
  let goldTotal = 0;
  let fullCoverage = 0;
  let corpusCovered = 0;
  let corpusTotal = 0;
  let filterChunks = 0;

  for (const result of results) {
    goldHitsRetrieval += result.retrieval.goldHits;
    goldHitsJina += result.afterJina.goldHits;
    goldHitsFilter += result.afterFilter.goldHits;
    goldTotal += result.retrieval.goldTotal;
    if (result.afterFilter.fullCoverage) {
      fullCoverage += 1;
    }
    if (result.afterFilter.corpusCoverage !== null) {
      corpusCovered += result.afterFilter.corpusCoverage;
      corpusTotal += result.afterFilter.corpusTotal ?? 0;
    }
    filterChunks += result.afterFilter.chunkCount;
  }

  const questionCount = results.length || 1;
  return {
    avgRetrievalRecall: goldTotal ? goldHitsRetrieval / goldTotal : 0,
    avgJinaRecall: goldTotal ? goldHitsJina / goldTotal : 0,
    avgFilterRecall: goldTotal ? goldHitsFilter / goldTotal : 0,
    fullCoverageRate: fullCoverage / questionCount,
    corpusCoverageRate: corpusTotal ? corpusCovered / corpusTotal : 0,
    avgFilterChunks: filterChunks / questionCount,
  };
}

export type HybridSmokeDecision =
  | 'HYBRID_NOT_USEFUL'
  | 'HYBRID_SURVIVES_RERANKER'
  | 'HYBRID_SURVIVES_WITH_FILTER_LOSS'
  | 'NEED_GENERATION_VALIDATION';

export function classifyHybridSmokeDecision(input: {
  vectorFilterRecall: number;
  unionFilterRecall: number;
  rrfFilterRecall: number;
  vectorRetrievalRecall: number;
  unionRetrievalRecall: number;
  bm25OnlySurviveFilter: number;
  bm25OnlyAtUnionRetrieval: number;
}): {
  category: HybridSmokeDecision;
  rationale: string;
} {
  const unionGainFilter =
    input.unionFilterRecall - input.vectorFilterRecall;
  const unionGainRetrieval =
    input.unionRetrievalRecall - input.vectorRetrievalRecall;

  if (unionGainFilter < 0.01 && input.bm25OnlySurviveFilter <= 1) {
    return {
      category: 'HYBRID_NOT_USEFUL',
      rationale:
        'Union ne bat pas vector apres filter (recall final) et les golds BM25-only ne survivent pas.',
    };
  }

  if (unionGainFilter >= 0.03) {
    return {
      category: 'NEED_GENERATION_VALIDATION',
      rationale:
        'Union ameliore le recall gold apres filter vs vector; validation generation/judge requise avant prod.',
    };
  }

  if (
    unionGainRetrieval >= 0.05 &&
    unionGainFilter >= 0.01 &&
    input.bm25OnlySurviveFilter >= 2
  ) {
    return {
      category: 'HYBRID_SURVIVES_WITH_FILTER_LOSS',
      rationale:
        'Gains hybrid visibles au retrieval/Jina mais partiellement absorbes par le filter; BM25-only partiellement conserve.',
    };
  }

  if (unionGainRetrieval >= 0.03 && unionGainFilter >= 0) {
    return {
      category: 'HYBRID_SURVIVES_RERANKER',
      rationale:
        'Hybrid conserve au moins les gains vector au filter, avec signal Jina sur candidats elargis.',
    };
  }

  return {
    category: 'HYBRID_NOT_USEFUL',
    rationale: 'Gains hybrid insuffisants apres rerank/filter vs vector.',
  };
}

function goldInChunks(
  gold: GoldArticle,
  chunks: Array<{ corpusId: string; articleNumber: string }>,
): boolean {
  return chunks.some((chunk) => goldArticlesMatch(gold, chunk));
}

/** Rebuild final RAG context from cached Jina top-5 + production dynamic filter (no Jina call). */
export async function rebuildFilteredContextFromSmokeVariant(input: {
  variant: HybridRerankFilterVariantResult;
  routedCorpusIds: string[];
}): Promise<{
  chunks: RerankedChunk[];
  context: string;
  sources: ReturnType<typeof buildRagContext>['sources'];
}> {
  const rows: RankedRetrievalChunk[] = input.variant.jinaTop5.map((row) => ({
    chunkId: row.chunkId,
    corpusId: row.corpusId,
    articleNumber: row.articleNumber,
    distance: 0,
    rank: row.rank,
  }));
  const similar = await hydrateRankedAsSimilar(rows);
  const reranked: RerankedChunk[] = similar.map((chunk, index) => ({
    ...chunk,
    rerankScore: input.variant.jinaTop5[index]!.score,
  }));
  const filterCorpusIds =
    input.routedCorpusIds.length > 1 ? input.routedCorpusIds : undefined;
  const filtered = dynamicContextFilter(reranked, {
    relativeScoreThreshold: DEFAULT_RELATIVE_SCORE_THRESHOLD,
    routedCorpusIds: filterCorpusIds,
  });
  const built = buildRagContext(filtered);
  return {
    chunks: filtered,
    context: built.context,
    sources: built.sources,
  };
}

export function finalContextChunkIdsEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  return sortedLeft.every((id, index) => id === sortedRight[index]);
}

export function goldStageFlags(
  gold: GoldArticle,
  stages: {
    retrieval: Array<{ corpusId: string; articleNumber: string }>;
    jina: Array<{ corpusId: string; articleNumber: string }>;
    filter: Array<{ corpusId: string; articleNumber: string }>;
  },
): {
  inRetrieval: boolean;
  inJina: boolean;
  inFilter: boolean;
} {
  return {
    inRetrieval: goldInChunks(gold, stages.retrieval),
    inJina: goldInChunks(gold, stages.jina),
    inFilter: goldInChunks(gold, stages.filter),
  };
}
