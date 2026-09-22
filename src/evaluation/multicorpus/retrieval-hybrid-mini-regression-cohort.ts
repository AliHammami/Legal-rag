import type { GoldArticle } from '../gold-article.js';
import { goldArticlesMatch } from '../gold-article.js';
import {
  finalContextChunkIdsEqual,
  type HybridRerankFilterVariantResult,
} from './retrieval-hybrid-rerank-filter-smoke.js';

export type MiniRegressionSlotCategory =
  | 'union_adds_gold'
  | 'context_diff_no_gold_gain'
  | 'multi_corpus_context_diff'
  | 'single_corpus_context_diff'
  | 'same_context_control';

export interface MiniRegressionCohortSlot {
  category: MiniRegressionSlotCategory;
  questionId: string;
  rationale: string;
}

export interface MiniRegressionCohortDefinition {
  questionIds: string[];
  slots: MiniRegressionCohortSlot[];
  rulesVersion: '2026-09-22-v1';
}

export interface MiniRegressionSmokeRecord {
  questionId: string;
  variants: {
    vector: HybridRerankFilterVariantResult;
    union: HybridRerankFilterVariantResult;
  };
}

export interface MiniRegressionQuestionMeta {
  questionId: string;
  questionType: string;
  goldArticles: GoldArticle[];
}

function goldInKeptFilter(
  goldArticles: GoldArticle[],
  variant: HybridRerankFilterVariantResult,
): GoldArticle[] {
  const kept = variant.filterRows.filter((row) => row.kept);
  return goldArticles.filter((gold) =>
    kept.some((row) => goldArticlesMatch(gold, row)),
  );
}

function uniqueSorted(ids: string[]): string[] {
  return [...new Set(ids)].sort((left, right) => left.localeCompare(right));
}

/**
 * Deterministic ~30 question cohort from hybrid rerank-filter smoke (61q).
 *
 * Priority order (fill up to maxSize):
 * 1. Union filter adds gold vs Vector filter (sorted by questionId)
 * 2. Context differs without extra gold (sorted)
 * 3. Multi-corpus among remaining context diffs (sorted)
 * 4. Single-corpus context diffs (sorted)
 * 5. Same final context controls (first 4 by questionId)
 */
export function buildHybridMiniRegressionCohort(input: {
  smokeRecords: MiniRegressionSmokeRecord[];
  metaById: Map<string, MiniRegressionQuestionMeta>;
  maxSize?: number;
}): MiniRegressionCohortDefinition {
  const maxSize = input.maxSize ?? 30;
  const slots: MiniRegressionCohortSlot[] = [];
  const used = new Set<string>();

  const add = (
    category: MiniRegressionSlotCategory,
    questionId: string,
    rationale: string,
  ): void => {
    if (used.has(questionId) || slots.length >= maxSize) {
      return;
    }
    used.add(questionId);
    slots.push({ category, questionId, rationale });
  };

  type Classified = {
    questionId: string;
    diffContext: boolean;
    unionAddsGold: boolean;
    questionType: string;
  };

  const classified: Classified[] = [];
  for (const record of input.smokeRecords) {
    const meta = input.metaById.get(record.questionId);
    if (!meta) {
      continue;
    }
    const vectorIds = record.variants.vector.finalContextChunkIds;
    const unionIds = record.variants.union.finalContextChunkIds;
    const diffContext = !finalContextChunkIdsEqual(vectorIds, unionIds);
    const vectorGold = goldInKeptFilter(meta.goldArticles, record.variants.vector);
    const unionGold = goldInKeptFilter(meta.goldArticles, record.variants.union);
    const unionAddsGold = unionGold.some(
      (gold) => !vectorGold.some((existing) => goldArticlesMatch(existing, gold)),
    );
    classified.push({
      questionId: record.questionId,
      diffContext,
      unionAddsGold,
      questionType: meta.questionType,
    });
  }

  const byId = (left: Classified, right: Classified) =>
    left.questionId.localeCompare(right.questionId);

  for (const row of classified.filter((row) => row.diffContext && row.unionAddsGold).sort(byId)) {
    add(
      'union_adds_gold',
      row.questionId,
      'Contexte final Union != Vector et au moins un gold supplementaire en filter Union.',
    );
  }

  let contextDiffNoGoldAdded = 0;
  for (const row of classified
    .filter((row) => row.diffContext && !row.unionAddsGold)
    .sort(byId)) {
    if (contextDiffNoGoldAdded >= 8) {
      break;
    }
    add(
      'context_diff_no_gold_gain',
      row.questionId,
      'Contexte final different sans gold supplementaire Union vs Vector.',
    );
    contextDiffNoGoldAdded += 1;
  }

  let multiAdded = 0;
  for (const row of classified
    .filter(
      (row) =>
        row.diffContext &&
        row.questionType === 'multi-corpus' &&
        !used.has(row.questionId),
    )
    .sort(byId)) {
    if (multiAdded >= 6) {
      break;
    }
    add(
      'multi_corpus_context_diff',
      row.questionId,
      'Multicorpus avec contexte final Vector != Union.',
    );
    multiAdded += 1;
  }

  let singleAdded = 0;
  for (const row of classified
    .filter(
      (row) =>
        row.diffContext &&
        row.questionType !== 'multi-corpus' &&
        !used.has(row.questionId),
    )
    .sort(byId)) {
    if (singleAdded >= 6) {
      break;
    }
    add(
      'single_corpus_context_diff',
      row.questionId,
      'Monocorpus avec contexte final Vector != Union.',
    );
    singleAdded += 1;
  }

  for (const row of classified.filter((row) => !row.diffContext).sort(byId).slice(0, 7)) {
    add(
      'same_context_control',
      row.questionId,
      'Controle: contexte final identique Vector/Union (smoke rerank-filter).',
    );
  }

  for (const row of classified.filter((row) => row.diffContext).sort(byId)) {
    if (slots.length >= maxSize) {
      break;
    }
    add(
      row.questionType === 'multi-corpus'
        ? 'multi_corpus_context_diff'
        : 'single_corpus_context_diff',
      row.questionId,
      'Remplissage deterministe cohorte 30.',
    );
  }

  return {
    questionIds: uniqueSorted(slots.map((slot) => slot.questionId)),
    slots,
    rulesVersion: '2026-09-22-v1',
  };
}
