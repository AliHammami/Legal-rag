import {
  goldArticlesMatch,
  goldArticleKey,
  type GoldArticle,
} from '../gold-article.js';
import {
  goldChunkStatsFromChunks,
  inferChunkingSignals,
  loadCorpusArticleChunks,
} from './retrieval-diagnostic.js';
import type { RankedRetrievalChunk } from './retrieval-depth-benchmark.js';
import {
  classifySemanticAbsence,
  CAUSE_LABELS,
  type SemanticCauseCategory,
} from './semantic-diagnostic-classifier.js';
import {
  areNeighborArticles,
  buildBm25Index,
  jaccardSimilarity,
  scoreBm25,
  sharedTokenSample,
  tokenizeForLexical,
} from './semantic-diagnostic-lexical.js';

export interface GoldRankDetailAbsentAt50 {
  questionId: string;
  gold: GoldArticle;
  strategy: string;
  rank20: number | null;
  rank50: number | null;
  absentAt20: boolean;
  depthBand: string;
}

export interface PerQuestionDepthRecord {
  questionId: string;
  question: string;
  questionType: string;
  routedCorpusIds: string[];
  goldArticles: GoldArticle[];
  quota: {
    byK: Record<string, RankedRetrievalChunk[]>;
  };
}

export interface CompetitorRow {
  rank: number;
  corpusId: string;
  articleNumber: string;
  distance: number | null;
  isGold: boolean;
}

export interface SemanticGoldCaseAnalysis {
  questionId: string;
  question: string;
  goldArticle: GoldArticle;
  goldCorpus: string;
  vectorRank50: null;
  competitorsTop50: CompetitorRow[];
  competitorsTop10: CompetitorRow[];
  goldTextPreview: string;
  goldChunkStats: ReturnType<typeof goldChunkStatsFromChunks>;
  chunkingSignals: string[];
  lexical: {
    questionTokenCount: number;
    goldCharLength: number;
    jaccardQuestionGold: number;
    sharedTokensQuestionGold: string[];
    topCompetitors: Array<{
      rank: number;
      corpusId: string;
      articleNumber: string;
      jaccardWithQuestion: number;
      sharedTokens: string[];
    }>;
  };
  neighborAnalysis: {
    neighborCountTop10: number;
    neighborArticlesTop10: string[];
    sameCorpusCountTop10: number;
  };
  bm25: {
    goldBestChunkRank: number | null;
    goldBestChunkScore: number | null;
    topBm25Articles: Array<{
      rank: number;
      corpusId: string;
      articleNumber: string;
      score: number;
    }>;
  };
  classification: ReturnType<typeof classifySemanticAbsence>;
  hypothesis: string;
}

function pickGoldText(chunks: Array<{ content: string }> | undefined): string {
  if (!chunks || chunks.length === 0) {
    return '';
  }
  return chunks.map((chunk) => chunk.content).join('\n');
}

export async function analyzeAbsentGoldCase(input: {
  detail: GoldRankDetailAbsentAt50;
  perQuestion: PerQuestionDepthRecord;
}): Promise<SemanticGoldCaseAnalysis> {
  const { detail, perQuestion } = input;
  const ranked50 = perQuestion.quota.byK['50'] ?? [];
  const competitorsTop50: CompetitorRow[] = ranked50.map((row) => ({
    rank: row.rank,
    corpusId: row.corpusId,
    articleNumber: row.articleNumber,
    distance: row.distance ?? null,
    isGold: goldArticlesMatch(detail.gold, row),
  }));
  const competitorsTop10 = competitorsTop50.filter((row) => row.rank <= 10);

  const corpusChunks = await loadCorpusArticleChunks(detail.gold.corpusId);
  const goldChunks = corpusChunks.get(detail.gold.articleNumber);
  const goldText = pickGoldText(goldChunks);
  const goldChunkStats = goldChunkStatsFromChunks(detail.gold, goldChunks);
  const chunkingSignals = inferChunkingSignals(goldChunkStats);

  const topCompetitorTexts: string[] = [];
  const topCompetitorMeta: SemanticGoldCaseAnalysis['lexical']['topCompetitors'] =
    [];

  for (const row of competitorsTop10.slice(0, 5)) {
    if (goldArticlesMatch(detail.gold, row)) {
      continue;
    }
    const compChunks = await loadCorpusArticleChunks(row.corpusId);
    const text = pickGoldText(compChunks.get(row.articleNumber));
    topCompetitorTexts.push(text);
    topCompetitorMeta.push({
      rank: row.rank,
      corpusId: row.corpusId,
      articleNumber: row.articleNumber,
      jaccardWithQuestion: jaccardSimilarity(perQuestion.question, text),
      sharedTokens: sharedTokenSample(perQuestion.question, text),
    });
  }

  const neighborArticlesTop10 = competitorsTop10
    .filter(
      (row) =>
        !goldArticlesMatch(detail.gold, row) &&
        areNeighborArticles(
          detail.gold.articleNumber,
          row.articleNumber,
          row.corpusId === detail.gold.corpusId,
        ),
    )
    .map((row) => `${row.corpusId}:${row.articleNumber}`);

  const sameCorpusCountTop10 = competitorsTop10.filter(
    (row) =>
      row.corpusId === detail.gold.corpusId &&
      !goldArticlesMatch(detail.gold, row),
  ).length;

  const bm25Documents: Array<{ id: string; text: string; corpusId: string; articleNumber: string }> =
    [];
  for (const corpusId of perQuestion.routedCorpusIds) {
    const byArticle = await loadCorpusArticleChunks(corpusId);
    for (const [articleNumber, chunks] of byArticle.entries()) {
      for (const chunk of chunks) {
        bm25Documents.push({
          id: chunk.chunkId,
          text: chunk.content,
          corpusId,
          articleNumber,
        });
      }
    }
  }

  const bm25Index = buildBm25Index(
    bm25Documents.map((doc) => ({ id: doc.id, text: doc.text })),
  );
  const bm25Scores = scoreBm25(bm25Index, perQuestion.question);
  const bm25Top50 = bm25Scores.slice(0, 50);
  const bm25Ranked = bm25Top50.map((entry, index) => {
    const doc = bm25Documents.find((item) => item.id === entry.id);
    return {
      rank: index + 1,
      corpusId: doc?.corpusId ?? 'unknown',
      articleNumber: doc?.articleNumber ?? entry.id.split('#')[0] ?? entry.id,
      score: entry.score,
    };
  });

  let goldBestBm25Rank: number | null = null;
  let goldBestBm25Score: number | null = null;
  for (let index = 0; index < bm25Scores.length; index += 1) {
    const entry = bm25Scores[index]!;
    const doc = bm25Documents.find((item) => item.id === entry.id);
    if (
      doc &&
      goldArticlesMatch(detail.gold, {
        corpusId: doc.corpusId,
        articleNumber: doc.articleNumber,
      })
    ) {
      goldBestBm25Rank = index + 1;
      goldBestBm25Score = entry.score;
      break;
    }
  }
  if (goldBestBm25Rank !== null && goldBestBm25Rank > 50) {
    goldBestBm25Rank = null;
  }

  const classification = classifySemanticAbsence({
    question: perQuestion.question,
    goldText,
    topCompetitorTexts,
    goldChunkStats,
    chunkingSignals,
    neighborCompetitorsInTop10: neighborArticlesTop10.length,
    sameCorpusCompetitorsInTop10: sameCorpusCountTop10,
    goldBm25Rank: goldBestBm25Rank,
    questionTokenCount: tokenizeForLexical(perQuestion.question).length,
  });

  let hypothesis = 'Signal insuffisant pour conclure.';
  if (classification.primary === 'semantic_competition') {
    hypothesis =
      'Des articles voisins du meme code occupent les rangs vectoriels; le gold pourrait etre noye dans une proximite semantique inter-articles.';
  } else if (classification.primary === 'lexical_mismatch') {
    hypothesis =
      'Les concurrents partagent plus de tokens avec la question que le gold; signal favorable a un futur hybrid lexical+vector.';
  } else if (classification.primary === 'query_formulation') {
    hypothesis =
      'Faible recouvrement lexical question-gold; la formulation peut etre trop conceptuelle ou elliptique pour l embedding seul.';
  } else if (classification.primary === 'chunk_representation') {
    hypothesis =
      'Le chunk gold est volumineux ou peu focal; la representation pourrait diluer le signal pertinent.';
  } else if (classification.primary === 'gold_intrinsically_difficult') {
    hypothesis =
      'Peu de proximite lexicale et BM25 eleve absent; l article est pertinent mais peu aligne surface avec la question.';
  }

  return {
    questionId: detail.questionId,
    question: perQuestion.question,
    goldArticle: detail.gold,
    goldCorpus: detail.gold.corpusId,
    vectorRank50: null,
    competitorsTop50,
    competitorsTop10,
    goldTextPreview: goldText.slice(0, 400),
    goldChunkStats,
    chunkingSignals,
    lexical: {
      questionTokenCount: tokenizeForLexical(perQuestion.question).length,
      goldCharLength: goldText.length,
      jaccardQuestionGold: jaccardSimilarity(perQuestion.question, goldText),
      sharedTokensQuestionGold: sharedTokenSample(
        perQuestion.question,
        goldText,
      ),
      topCompetitors: topCompetitorMeta,
    },
    neighborAnalysis: {
      neighborCountTop10: neighborArticlesTop10.length,
      neighborArticlesTop10,
      sameCorpusCountTop10,
    },
    bm25: {
      goldBestChunkRank: goldBestBm25Rank,
      goldBestChunkScore: goldBestBm25Score,
      topBm25Articles: bm25Ranked.slice(0, 10),
    },
    classification,
    hypothesis,
  };
}

export function extractAbsentAt50Cohort(
  goldRankDetails: GoldRankDetailAbsentAt50[],
): GoldRankDetailAbsentAt50[] {
  return goldRankDetails.filter(
    (detail) => detail.absentAt20 && detail.depthBand === 'absent_at_50',
  );
}

export function summarizeClassifications(
  cases: SemanticGoldCaseAnalysis[],
): Record<SemanticCauseCategory, number> {
  const counts: Record<SemanticCauseCategory, number> = {
    query_formulation: 0,
    chunk_representation: 0,
    semantic_competition: 0,
    lexical_mismatch: 0,
    gold_intrinsically_difficult: 0,
    chunking_data: 0,
    indeterminate: 0,
  };
  for (const item of cases) {
    counts[item.classification.primary] += 1;
  }
  return counts;
}

export function summarizeBm25Recovery(
  cases: SemanticGoldCaseAnalysis[],
): {
  vectorAbsentCount: number;
  bm25RecoveredAt50: number;
  unionRecoveredAt50: number;
} {
  let bm25Recovered = 0;
  let unionRecovered = 0;
  for (const item of cases) {
    const bm25Hit =
      item.bm25.goldBestChunkRank !== null &&
      item.bm25.goldBestChunkRank <= 50;
    if (bm25Hit) {
      bm25Recovered += 1;
    }
    if (bm25Hit) {
      unionRecovered += 1;
    }
  }
  return {
    vectorAbsentCount: cases.length,
    bm25RecoveredAt50: bm25Recovered,
    unionRecoveredAt50: unionRecovered,
  };
}

export function pickRepresentativeCases(
  cases: SemanticGoldCaseAnalysis[],
  limit = 8,
): SemanticGoldCaseAnalysis[] {
  const byCategory = new Map<SemanticCauseCategory, SemanticGoldCaseAnalysis[]>();
  for (const item of cases) {
    const list = byCategory.get(item.classification.primary) ?? [];
    list.push(item);
    byCategory.set(item.classification.primary, list);
  }
  const picked: SemanticGoldCaseAnalysis[] = [];
  for (const list of byCategory.values()) {
    picked.push(...list.slice(0, 2));
  }
  return picked.slice(0, limit);
}

export { CAUSE_LABELS, goldArticleKey };
