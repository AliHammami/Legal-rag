import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { PenalCodeChunk, PenalCodeChunkingResult } from '../../chunking/types.js';
import {
  goldArticlesMatch,
  goldArticleKey,
  type GoldArticle,
} from '../gold-article.js';
import type { ContextLossReason } from './context-loss-forensic-audit.js';
import type {
  PersistedRerankChunk,
  PersistedRetrievalChunk,
} from './rerank-filter-quota-audit.js';

export type CompetitorPattern =
  | 'A_same_corpus_wrong_article'
  | 'B_semantically_close_wrong_article'
  | 'C_similar_vocabulary_chunk'
  | 'D_other_corpus_dominant'
  | 'E_generic_or_definition_chunk'
  | 'F_no_plausible_neighbor'
  | 'not_applicable';

export type DiagnosticCauseCategory =
  | 'depth_topk_unproven'
  | 'semantic_mismatch'
  | 'chunking_signal'
  | 'multicorpus_competition'
  | 'reranking'
  | 'filter'
  | 'indeterminate';

export interface GoldChunkStats {
  corpusId: string;
  articleNumber: string;
  chunkCount: number;
  totalChars: number;
  maxChunkChars: number;
  multiChunk: boolean;
  overTargetSize: boolean;
}

export interface CompetitorAnalysis {
  pattern: CompetitorPattern;
  goldCorpusRepresentedInTop20: boolean;
  goldArticleInRetrievalTop20: boolean;
  goldArticleInRerankTop5: boolean;
  retrievalTopArticles: string[];
  rerankTopArticles: string[];
  sameCorpusAlternatives: string[];
  corpusSlotCounts: Record<string, number>;
  notes: string[];
}

export interface GoldLossDiagnostic {
  questionId: string;
  question: string;
  gold: GoldArticle;
  pipelineStage: ContextLossReason;
  causeCategory: DiagnosticCauseCategory;
  competitor: CompetitorAnalysis;
  goldChunkStats: GoldChunkStats | null;
  chunkingSignals: string[];
}

export interface CauseMatrixRow {
  category: DiagnosticCauseCategory;
  label: string;
  count: number;
}

export interface RetrievalArchitectureFacts {
  embeddingInput: string;
  embeddingModelConfigKey: 'OPENAI_EMBEDDING_MODEL';
  embeddingDimensions: number;
  distanceMetric: 'cosine (<=> pgvector on legal_code_chunks.embedding)';
  table: string;
  ordering: 'ASC distance (lower = closer)';
  singleCorpusSearch: 'one SQL query, corpus_id filter, LIMIT topK';
  multiCorpusSearch: 'per-corpus SQL with ceil(topK/n) each, merge dedupe, sort by distance, slice topK';
  queryNormalization: 'question.trim(); empty rejected';
  returnedFields: string[];
  chunkIdFormat: 'articleNumber#chunkIndex';
}

export const RETRIEVAL_ARCHITECTURE_FACTS: RetrievalArchitectureFacts = {
  embeddingInput:
    'Exact string passed to searchQuestion: validateQuestion(question) => question.trim() � no prefix/suffix, no routing context, no corpus hint in the embedding text.',
  embeddingModelConfigKey: 'OPENAI_EMBEDDING_MODEL',
  embeddingDimensions: 3072,
  distanceMetric: 'cosine (<=> pgvector on legal_code_chunks.embedding)',
  table: 'legal_code_chunks',
  ordering: 'ASC distance (lower = closer)',
  singleCorpusSearch: 'one SQL query, corpus_id filter, LIMIT topK',
  multiCorpusSearch:
    'per-corpus SQL with ceil(topK/n) each, merge dedupe, sort by distance, slice topK',
  queryNormalization: 'question.trim(); empty rejected',
  returnedFields: [
    'corpusId',
    'chunkId',
    'articleNumber',
    'content',
    'metadata (PenalCodeChunkMetadata)',
    'distance',
  ],
  chunkIdFormat: 'articleNumber#chunkIndex',
};

const CHUNKING_TARGET = 1500;
const CHUNKING_MAX = 2000;

const corpusChunkCache = new Map<string, Map<string, PenalCodeChunk[]>>();

export async function loadCorpusArticleChunks(
  corpusId: string,
  processedDir = 'data/processed',
): Promise<Map<string, PenalCodeChunk[]>> {
  const cached = corpusChunkCache.get(corpusId);
  if (cached) {
    return cached;
  }

  const path = join(processedDir, `${corpusId}.chunks.json`);
  const raw = await readFile(path, 'utf-8');
  const parsed = JSON.parse(raw) as PenalCodeChunkingResult;
  const byArticle = new Map<string, PenalCodeChunk[]>();

  for (const chunk of parsed.chunks) {
    const list = byArticle.get(chunk.articleNumber) ?? [];
    list.push(chunk);
    byArticle.set(chunk.articleNumber, list);
  }

  corpusChunkCache.set(corpusId, byArticle);
  return byArticle;
}

export function goldChunkStatsFromChunks(
  gold: GoldArticle,
  chunks: PenalCodeChunk[] | undefined,
): GoldChunkStats | null {
  if (!chunks || chunks.length === 0) {
    return null;
  }

  const charCounts = chunks.map((chunk) => chunk.content.length);
  const totalChars = charCounts.reduce((sum, count) => sum + count, 0);
  const maxChunkChars = Math.max(...charCounts);

  return {
    corpusId: gold.corpusId,
    articleNumber: gold.articleNumber,
    chunkCount: chunks.length,
    totalChars,
    maxChunkChars,
    multiChunk: chunks.length > 1,
    overTargetSize: maxChunkChars > CHUNKING_TARGET,
  };
}

export function inferChunkingSignals(stats: GoldChunkStats | null): string[] {
  if (!stats) {
    return ['gold-chunk-file-missing'];
  }

  const signals: string[] = [];
  if (stats.multiChunk) {
    signals.push('article-multi-chunk');
  }
  if (stats.maxChunkChars >= CHUNKING_MAX) {
    signals.push('chunk-at-max-size');
  }
  if (stats.totalChars < 120) {
    signals.push('article-very-short');
  }
  if (stats.totalChars > CHUNKING_TARGET * 2 && stats.multiChunk) {
    signals.push('information-split-across-chunks');
  }
  return signals;
}

function articleLabel(chunk: { corpusId: string; articleNumber: string }): string {
  return `${chunk.corpusId}:${chunk.articleNumber}`;
}

function uniqueArticles(
  chunks: Array<{ corpusId: string; articleNumber: string }>,
): string[] {
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const chunk of chunks) {
    const label = articleLabel(chunk);
    if (seen.has(label)) {
      continue;
    }
    seen.add(label);
    labels.push(label);
  }
  return labels;
}

function sharedNumericPrefix(left: string, right: string): boolean {
  const leftMatch = left.match(/^L?\d+/);
  const rightMatch = right.match(/^L?\d+/);
  if (!leftMatch || !rightMatch) {
    return false;
  }
  return leftMatch[0] === rightMatch[0];
}

export function analyzeCompetitors(input: {
  gold: GoldArticle;
  retrieval: PersistedRetrievalChunk[];
  rerank: PersistedRerankChunk[];
  routedCorpusIds: string[];
}): CompetitorAnalysis {
  const { gold, retrieval, rerank, routedCorpusIds } = input;
  const notes: string[] = [];
  const corpusSlotCounts: Record<string, number> = {};

  for (const chunk of retrieval) {
    corpusSlotCounts[chunk.corpusId] = (corpusSlotCounts[chunk.corpusId] ?? 0) + 1;
  }

  const goldCorpusRepresentedInTop20 = retrieval.some(
    (chunk) => chunk.corpusId === gold.corpusId,
  );
  const goldArticleInRetrievalTop20 = retrieval.some((chunk) =>
    goldArticlesMatch(gold, chunk),
  );
  const goldArticleInRerankTop5 = rerank.some((chunk) =>
    goldArticlesMatch(gold, chunk),
  );

  const sameCorpusAlternatives = uniqueArticles(
    retrieval.filter(
      (chunk) =>
        chunk.corpusId === gold.corpusId &&
        !goldArticlesMatch(gold, chunk),
    ),
  );

  let pattern: CompetitorPattern = 'not_applicable';

  if (!goldArticleInRetrievalTop20) {
    if (!goldCorpusRepresentedInTop20) {
      pattern = 'D_other_corpus_dominant';
      notes.push('Aucun chunk du corpus gold dans le top20.');
    } else if (sameCorpusAlternatives.length > 0) {
      const neighbor = sameCorpusAlternatives.some((label) => {
        const articleNumber = label.split(':')[1] ?? '';
        return (
          sharedNumericPrefix(articleNumber, gold.articleNumber) ||
          articleNumber.startsWith(gold.articleNumber.split('-')[0] ?? '')
        );
      });
      pattern = neighbor
        ? 'A_same_corpus_wrong_article'
        : 'B_semantically_close_wrong_article';
    } else {
      pattern = 'F_no_plausible_neighbor';
    }

    const dominantCorpus = Object.entries(corpusSlotCounts).sort(
      (left, right) => right[1]! - left[1]!,
    )[0];
    if (
      routedCorpusIds.length > 1 &&
      dominantCorpus &&
      dominantCorpus[0] !== gold.corpusId &&
      dominantCorpus[1]! >= 12
    ) {
      notes.push(
        `Corpus dominant ${dominantCorpus[0]} (${dominantCorpus[1]}/20 slots).`,
      );
    }
  }

  return {
    pattern,
    goldCorpusRepresentedInTop20,
    goldArticleInRetrievalTop20,
    goldArticleInRerankTop5,
    retrievalTopArticles: uniqueArticles(retrieval.slice(0, 10)),
    rerankTopArticles: uniqueArticles(rerank),
    sameCorpusAlternatives,
    corpusSlotCounts,
    notes,
  };
}

export function classifyGoldLossCause(input: {
  pipelineStage: ContextLossReason;
  competitor: CompetitorAnalysis;
  chunkingSignals: string[];
}): DiagnosticCauseCategory {
  const { pipelineStage, competitor, chunkingSignals } = input;

  if (pipelineStage === 'R4') {
    return 'indeterminate';
  }
  if (pipelineStage === 'R1') {
    return 'reranking';
  }
  if (pipelineStage === 'R2') {
    return 'filter';
  }

  if (pipelineStage === 'R0') {
    if (
      competitor.pattern === 'D_other_corpus_dominant' &&
      !competitor.goldCorpusRepresentedInTop20
    ) {
      return 'multicorpus_competition';
    }
    if (
      competitor.pattern === 'A_same_corpus_wrong_article' ||
      competitor.pattern === 'B_semantically_close_wrong_article' ||
      competitor.pattern === 'C_similar_vocabulary_chunk'
    ) {
      return 'semantic_mismatch';
    }
    if (chunkingSignals.includes('information-split-across-chunks')) {
      return 'chunking_signal';
    }
    return 'semantic_mismatch';
  }

  return 'indeterminate';
}

export function summarizeCauseMatrix(
  diagnostics: GoldLossDiagnostic[],
): CauseMatrixRow[] {
  const labels: Record<DiagnosticCauseCategory, string> = {
    depth_topk_unproven: 'Profondeur topK (non d?montr?e sans top>20)',
    semantic_mismatch: 'Mauvais matching s?mantique / mauvais article m?me corpus',
    chunking_signal: 'Signal chunking (multi-chunk / split)',
    multicorpus_competition: 'Comp?tition multicorpus (corpus gold absent top20)',
    reranking: 'Reranking Jina (gold top20, absent top5)',
    filter: 'Dynamic filter (gold top5, supprim?)',
    indeterminate: 'Ind?termin? (pas de trace pipeline)',
  };

  const counts = new Map<DiagnosticCauseCategory, number>();
  for (const diagnostic of diagnostics) {
    counts.set(
      diagnostic.causeCategory,
      (counts.get(diagnostic.causeCategory) ?? 0) + 1,
    );
  }

  return (Object.keys(labels) as DiagnosticCauseCategory[]).map((category) => ({
    category,
    label: labels[category],
    count: counts.get(category) ?? 0,
  }));
}

export function summarizeCompetitorPatterns(
  diagnostics: GoldLossDiagnostic[],
): Record<CompetitorPattern, number> {
  const counts: Record<CompetitorPattern, number> = {
    A_same_corpus_wrong_article: 0,
    B_semantically_close_wrong_article: 0,
    C_similar_vocabulary_chunk: 0,
    D_other_corpus_dominant: 0,
    E_generic_or_definition_chunk: 0,
    F_no_plausible_neighbor: 0,
    not_applicable: 0,
  };

  for (const diagnostic of diagnostics) {
    if (diagnostic.pipelineStage === 'R0') {
      counts[diagnostic.competitor.pattern] += 1;
    } else {
      counts.not_applicable += 1;
    }
  }

  return counts;
}

export interface ContextLossAuditRecord {
  questionId: string;
  question: string;
  routedCorpusIds: string[];
  goldArticleLosses: Array<{
    gold: GoldArticle;
    reason: ContextLossReason;
  }>;
  pipelineRetrieval?: PersistedRetrievalChunk[];
  pipelineRerank?: PersistedRerankChunk[];
}

export async function buildGoldLossDiagnostics(
  records: ContextLossAuditRecord[],
): Promise<GoldLossDiagnostic[]> {
  const diagnostics: GoldLossDiagnostic[] = [];

  for (const record of records) {
    if (!record.pipelineRetrieval || !record.pipelineRerank) {
      for (const loss of record.goldArticleLosses) {
        diagnostics.push({
          questionId: record.questionId,
          question: record.question,
          gold: loss.gold,
          pipelineStage: loss.reason,
          causeCategory: 'indeterminate',
          competitor: analyzeCompetitors({
            gold: loss.gold,
            retrieval: [],
            rerank: [],
            routedCorpusIds: record.routedCorpusIds,
          }),
          goldChunkStats: null,
          chunkingSignals: ['no-pipeline-trace'],
        });
      }
      continue;
    }

    const corpusCache = new Map<string, Map<string, PenalCodeChunk[]>>();

    for (const loss of record.goldArticleLosses) {
      let byArticle = corpusCache.get(loss.gold.corpusId);
      if (!byArticle) {
        byArticle = await loadCorpusArticleChunks(loss.gold.corpusId);
        corpusCache.set(loss.gold.corpusId, byArticle);
      }
      const stats = goldChunkStatsFromChunks(
        loss.gold,
        byArticle.get(loss.gold.articleNumber),
      );
      const chunkingSignals = inferChunkingSignals(stats);
      const competitor = analyzeCompetitors({
        gold: loss.gold,
        retrieval: record.pipelineRetrieval,
        rerank: record.pipelineRerank,
        routedCorpusIds: record.routedCorpusIds,
      });
      const causeCategory = classifyGoldLossCause({
        pipelineStage: loss.reason,
        competitor,
        chunkingSignals,
      });

      diagnostics.push({
        questionId: record.questionId,
        question: record.question,
        gold: loss.gold,
        pipelineStage: loss.reason,
        causeCategory,
        competitor,
        goldChunkStats: stats,
        chunkingSignals,
      });
    }
  }

  return diagnostics;
}

export function pickRepresentativeExamples(
  diagnostics: GoldLossDiagnostic[],
  limit = 10,
): GoldLossDiagnostic[] {
  const priority: DiagnosticCauseCategory[] = [
    'semantic_mismatch',
    'multicorpus_competition',
    'reranking',
    'filter',
    'chunking_signal',
    'indeterminate',
  ];

  const picked: GoldLossDiagnostic[] = [];
  const used = new Set<string>();

  for (const category of priority) {
    for (const diagnostic of diagnostics) {
      const key = goldArticleKey(diagnostic.gold);
      if (diagnostic.causeCategory !== category || used.has(key)) {
        continue;
      }
      picked.push(diagnostic);
      used.add(key);
      if (picked.length >= limit) {
        return picked;
      }
    }
  }

  return picked;
}
