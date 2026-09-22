import type { LegalMulticorpusEvaluationQuestion } from '../multicorpus-dataset.types.js';
import type { E2EQuestionResult, RoutingQuestionResult } from './types.js';

export type RegressionCohortSlotCategory =
  | 'topk30_gain'
  | 'multi_corpus_retrieval_loss'
  | 'multi_corpus_rerank_loss'
  | 'multi_corpus_filter_loss'
  | 'monocorpus_baseline_good'
  | 'abstention_ambiguous'
  | 'abstention_out_of_scope'
  | 'abstention_router_empty'
  | 'normal_baseline';

export interface RegressionCohortSlot {
  category: RegressionCohortSlotCategory;
  questionId: string;
  rationale: string;
}

export interface RegressionCohortDefinition {
  questionIds: string[];
  slots: RegressionCohortSlot[];
}

interface ContextLossRecord {
  questionId: string;
  questionType: string;
  primaryLossStage?: string;
}

const TOPK30_GAINS = ['q334', 'q367', 'q378'] as const;

function uniqueSorted(ids: string[]): string[] {
  return [...new Set(ids)].sort((left, right) => left.localeCompare(right));
}

export function buildRetrievalTop30RegressionCohort(input: {
  datasetQuestions: LegalMulticorpusEvaluationQuestion[];
  contextLossRecords: ContextLossRecord[];
  e2eResults: E2EQuestionResult[];
  routingResults: RoutingQuestionResult[];
  maxQuestions?: number;
}): RegressionCohortDefinition {
  const maxQuestions = input.maxQuestions ?? 30;
  const slots: RegressionCohortSlot[] = [];
  const used = new Set<string>();

  const add = (
    category: RegressionCohortSlotCategory,
    questionId: string,
    rationale: string,
  ): void => {
    if (used.has(questionId)) {
      return;
    }
    used.add(questionId);
    slots.push({ category, questionId, rationale });
  };

  for (const questionId of TOPK30_GAINS) {
    add(
      'topk30_gain',
      questionId,
      'Gold recupere uniquement en rangs 21-30 dans le smoke topK=30.',
    );
  }

  const multiRecords = input.contextLossRecords
    .filter((record) => record.questionType === 'multi-corpus')
    .sort((left, right) => left.questionId.localeCompare(right.questionId));

  for (const questionId of multiRecords
    .filter((record) => record.primaryLossStage === 'retrieval')
    .map((record) => record.questionId)
    .slice(0, 4)) {
    add(
      'multi_corpus_retrieval_loss',
      questionId,
      'Multicorpus avec perte gold localisee retrieval (audit context-loss).',
    );
  }

  const rerankLoss = multiRecords.find(
    (record) => record.primaryLossStage === 'reranking',
  );
  if (rerankLoss) {
    add(
      'multi_corpus_rerank_loss',
      rerankLoss.questionId,
      'Multicorpus avec perte gold localisee reranking (audit context-loss).',
    );
  }

  const filterLoss = multiRecords.find(
    (record) => record.primaryLossStage === 'filter',
  );
  if (filterLoss) {
    add(
      'multi_corpus_filter_loss',
      filterLoss.questionId,
      'Multicorpus avec perte gold localisee filter (audit context-loss).',
    );
  }

  const monocorpusGood = input.e2eResults
    .filter(
      (result) =>
        result.questionType === 'single-corpus' &&
        (result.routing?.judge?.correctness ?? 0) >= 4 &&
        (result.routing?.judge?.groundedness ?? 0) >= 4,
    )
    .sort((left, right) => left.questionId.localeCompare(right.questionId))
    .slice(0, 4);

  for (const result of monocorpusGood) {
    add(
      'monocorpus_baseline_good',
      result.questionId,
      'Monocorpus avec correctness/groundedness >= 4 sur E2E500 routing @20.',
    );
  }

  const ambiguous = input.datasetQuestions
    .filter((question) => question.questionType === 'ambiguous')
    .map((question) => question.id)
    .sort((left, right) => left.localeCompare(right));
  for (const questionId of ambiguous.slice(0, 2)) {
    add(
      'abstention_ambiguous',
      questionId,
      'Question ambigue — abstention attendue.',
    );
  }

  const outOfScope = input.datasetQuestions
    .filter((question) => question.questionType === 'out-of-scope')
    .map((question) => question.id)
    .sort((left, right) => left.localeCompare(right));
  for (const questionId of outOfScope.slice(0, 2)) {
    add(
      'abstention_out_of_scope',
      questionId,
      'Question hors perimetre — abstention attendue.',
    );
  }

  const routerEmpty = input.routingResults
    .filter((result) => result.predictedCorpusIds.length === 0)
    .sort((left, right) => left.questionId.localeCompare(right.questionId))[0];
  if (routerEmpty) {
    add(
      'abstention_router_empty',
      routerEmpty.questionId,
      'Router V3.1 retourne predictedCorpusIds=[] (run routing 2026-09-19).',
    );
  }

  const normal = input.e2eResults
    .filter(
      (result) =>
        result.questionType === 'single-corpus' &&
        !used.has(result.questionId) &&
        (result.routing?.judge?.correctness ?? 0) >= 3 &&
        (result.routing?.judge?.completeness ?? 0) >= 3,
    )
    .sort((left, right) => left.questionId.localeCompare(right.questionId));

  for (const result of normal) {
    if (slots.length >= maxQuestions) {
      break;
    }
    add(
      'normal_baseline',
      result.questionId,
      'Monocorpus stable sur E2E500 routing @20 (correctness/completeness >= 3).',
    );
  }

  const questionIds = slots.map((slot) => slot.questionId).slice(0, maxQuestions);
  return {
    questionIds: uniqueSorted(questionIds),
    slots: slots.filter((slot) => questionIds.includes(slot.questionId)),
  };
}
