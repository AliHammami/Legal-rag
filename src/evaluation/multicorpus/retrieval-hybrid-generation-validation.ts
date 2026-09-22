import {
  goldArticleKey,
  goldArticlesMatch,
  type GoldArticle,
} from '../gold-article.js';
import type { HybridRerankFilterVariantResult } from './retrieval-hybrid-rerank-filter-smoke.js';
import { finalContextChunkIdsEqual } from './retrieval-hybrid-rerank-filter-smoke.js';

export type HybridGenerationCohortTier =
  | 'union_adds_gold'
  | 'bm25_only_signal'
  | 'context_diff_only';

export interface HybridGenerationCohortEntry {
  questionId: string;
  tier: HybridGenerationCohortTier;
  goldAddedByUnion: GoldArticle[];
  vectorContextChunkIds: string[];
  unionContextChunkIds: string[];
}

export interface HybridBenchmarkQuestionMeta {
  questionId: string;
  goldArticles: GoldArticle[];
  goldArticlesBm25Only: GoldArticle[];
  routedCorpusIds: string[];
}

export interface SmokeQuestionCacheRecord {
  questionId: string;
  variants: {
    vector: HybridRerankFilterVariantResult;
    union: HybridRerankFilterVariantResult;
  };
}

export interface JudgeMetricSnapshot {
  correctness: number;
  completeness: number;
  groundedness: number;
  sourceRelevance: number;
  sourceCoverage: number;
}

export type GoldAddedImpact =
  | 'improves_answer'
  | 'neutral'
  | 'noise_or_confusion'
  | 'degrades_answer';

export type HybridGenerationDecisionCategory =
  | 'HYBRID_IMPROVES_ANSWERS'
  | 'HYBRID_NO_MEASURABLE_BENEFIT'
  | 'HYBRID_MIXED_RESULTS'
  | 'INSUFFICIENT_EVIDENCE';

function goldInKeptFilter(
  goldArticles: GoldArticle[],
  variant: HybridRerankFilterVariantResult,
): GoldArticle[] {
  const kept = variant.filterRows.filter((row) => row.kept);
  return goldArticles.filter((gold) =>
    kept.some((row) => goldArticlesMatch(gold, row)),
  );
}

export function selectHybridGenerationValidationCohort(
  records: SmokeQuestionCacheRecord[],
  metaById: Map<string, HybridBenchmarkQuestionMeta>,
  options?: { maxSize?: number },
): {
  entries: HybridGenerationCohortEntry[];
  skippedSameContext: number;
} {
  const maxSize = options?.maxSize ?? 20;
  const tier1: HybridGenerationCohortEntry[] = [];
  const tier2: HybridGenerationCohortEntry[] = [];
  const tier3: HybridGenerationCohortEntry[] = [];
  let skippedSameContext = 0;

  for (const record of records) {
    const vectorIds = record.variants.vector.finalContextChunkIds;
    const unionIds = record.variants.union.finalContextChunkIds;
    if (finalContextChunkIdsEqual(vectorIds, unionIds)) {
      skippedSameContext += 1;
      continue;
    }

    const meta = metaById.get(record.questionId);
    if (!meta) {
      continue;
    }

    const vectorGold = goldInKeptFilter(meta.goldArticles, record.variants.vector);
    const unionGold = goldInKeptFilter(meta.goldArticles, record.variants.union);
    const goldAddedByUnion = unionGold.filter(
      (gold) => !vectorGold.some((existing) => goldArticlesMatch(existing, gold)),
    );

    const entry: HybridGenerationCohortEntry = {
      questionId: record.questionId,
      goldAddedByUnion,
      vectorContextChunkIds: vectorIds,
      unionContextChunkIds: unionIds,
      tier: 'context_diff_only',
    };

    if (goldAddedByUnion.length > 0) {
      entry.tier = 'union_adds_gold';
      tier1.push(entry);
      continue;
    }

    const bm25OnlyInUnionFilter = meta.goldArticlesBm25Only.some((gold) =>
      record.variants.union.filterRows.some(
        (row) => row.kept && goldArticlesMatch(gold, row),
      ),
    );
    if (bm25OnlyInUnionFilter) {
      entry.tier = 'bm25_only_signal';
      tier2.push(entry);
      continue;
    }

    tier3.push(entry);
  }

  const ordered = [...tier1, ...tier2, ...tier3];
  return {
    entries: ordered.slice(0, maxSize),
    skippedSameContext,
  };
}

export function averageJudgeMetrics(
  rows: JudgeMetricSnapshot[],
): JudgeMetricSnapshot {
  const count = rows.length || 1;
  const sum = rows.reduce(
    (acc, row) => ({
      correctness: acc.correctness + row.correctness,
      completeness: acc.completeness + row.completeness,
      groundedness: acc.groundedness + row.groundedness,
      sourceRelevance: acc.sourceRelevance + row.sourceRelevance,
      sourceCoverage: acc.sourceCoverage + row.sourceCoverage,
    }),
    {
      correctness: 0,
      completeness: 0,
      groundedness: 0,
      sourceRelevance: 0,
      sourceCoverage: 0,
    },
  );
  return {
    correctness: sum.correctness / count,
    completeness: sum.completeness / count,
    groundedness: sum.groundedness / count,
    sourceRelevance: sum.sourceRelevance / count,
    sourceCoverage: sum.sourceCoverage / count,
  };
}

export function classifyGoldAddedImpact(input: {
  vector: JudgeMetricSnapshot;
  union: JudgeMetricSnapshot;
  goldAddedByUnion: GoldArticle[];
}): GoldAddedImpact {
  if (input.goldAddedByUnion.length === 0) {
    return 'neutral';
  }

  const correctnessDelta = input.union.correctness - input.vector.correctness;
  const completenessDelta = input.union.completeness - input.vector.completeness;
  const groundednessDelta = input.union.groundedness - input.vector.groundedness;

  if (correctnessDelta >= 0.5 || completenessDelta >= 0.5) {
    return 'improves_answer';
  }
  if (correctnessDelta <= -0.5 || completenessDelta <= -0.5) {
    return 'degrades_answer';
  }
  if (
    groundednessDelta <= -0.5 &&
    Math.abs(correctnessDelta) < 0.25 &&
    Math.abs(completenessDelta) < 0.25
  ) {
    return 'noise_or_confusion';
  }
  return 'neutral';
}

export function classifyHybridGenerationDecision(input: {
  cohortSize: number;
  vectorAvg: JudgeMetricSnapshot;
  unionAvg: JudgeMetricSnapshot;
  perQuestion: Array<{
    vector: JudgeMetricSnapshot;
    union: JudgeMetricSnapshot;
  }>;
}): {
  category: HybridGenerationDecisionCategory;
  rationale: string;
  recommendation: string;
} {
  if (input.cohortSize < 5) {
    return {
      category: 'INSUFFICIENT_EVIDENCE',
      rationale: `Cohorte trop petite (${input.cohortSize} questions).`,
      recommendation:
        'Elargir la cohorte ou repeter apres plus de divergences contexte Vector/Union.',
    };
  }

  const delta = {
    correctness: input.unionAvg.correctness - input.vectorAvg.correctness,
    completeness: input.unionAvg.completeness - input.vectorAvg.completeness,
    groundedness: input.unionAvg.groundedness - input.vectorAvg.groundedness,
    sourceRelevance:
      input.unionAvg.sourceRelevance - input.vectorAvg.sourceRelevance,
    sourceCoverage: input.unionAvg.sourceCoverage - input.vectorAvg.sourceCoverage,
  };

  let unionWins = 0;
  let unionLosses = 0;
  for (const row of input.perQuestion) {
    const scoreDelta =
      row.union.correctness +
      row.union.completeness -
      (row.vector.correctness + row.vector.completeness);
    if (scoreDelta >= 0.5) {
      unionWins += 1;
    } else if (scoreDelta <= -0.5) {
      unionLosses += 1;
    }
  }

  const clearImprovement =
    delta.correctness >= 0.25 &&
    delta.completeness >= 0.15 &&
    delta.groundedness >= -0.25;

  if (clearImprovement && unionWins > unionLosses) {
    return {
      category: 'HYBRID_IMPROVES_ANSWERS',
      rationale: `Union bat Vector en moyenne (correctness ${delta.correctness.toFixed(2)}, completeness ${delta.completeness.toFixed(2)}).`,
      recommendation:
        '? mini test de non-regression production\n? puis eventuelle integration hybrid',
    };
  }

  if (
    delta.correctness <= 0 &&
    delta.completeness <= 0.05 &&
    unionWins <= unionLosses
  ) {
    return {
      category: 'HYBRID_NO_MEASURABLE_BENEFIT',
      rationale:
        'Union n ameliore pas les scores judge moyens vs Vector sur la cohorte ciblee.',
      recommendation:
        '? ne pas integrer hybrid pour l instant\n? arreter les investigations retrieval',
    };
  }

  if (unionWins > 0 && unionLosses > 0) {
    return {
      category: 'HYBRID_MIXED_RESULTS',
      rationale: `Gains heterogenes (${unionWins} questions gagnantes, ${unionLosses} perdantes).`,
      recommendation:
        'Analyser les cas gagnants (gold Union) vs perdants avant toute integration.',
    };
  }

  if (delta.completeness > 0.1 || delta.correctness > 0.1) {
    return {
      category: 'HYBRID_MIXED_RESULTS',
      rationale:
        'Signal positif faible en moyenne sans domination claire question par question.',
      recommendation:
        'Une seule experience supplementaire seulement si un sous-ensemble gold-Union reste prometteur.',
    };
  }

  return {
    category: 'HYBRID_NO_MEASURABLE_BENEFIT',
    rationale: 'Pas de gain judge mesurable sur la cohorte.',
    recommendation:
      '? ne pas integrer hybrid pour l instant\n? arreter les investigations retrieval',
  };
}

export function formatGoldList(golds: GoldArticle[]): string[] {
  return golds.map((gold) => `${gold.corpusId}:${gold.articleNumber}`);
}

export function uniqueGoldKeys(golds: GoldArticle[]): string[] {
  return [...new Set(golds.map((gold) => goldArticleKey(gold)))];
}
