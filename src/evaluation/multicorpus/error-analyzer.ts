import { JUDGE_PASS_SCORE_THRESHOLD } from '../report-metrics.js';
import type { LegalMulticorpusEvaluationQuestion } from '../multicorpus-dataset.types.js';
import { corpusSet, setsEqual } from './metrics.js';
import type {
  E2EQuestionResult,
  FailureStage,
  RerankingQuestionResult,
  RetrievalQuestionResult,
  RoutingQuestionResult,
} from './types.js';

export function classifyRoutingFailure(
  question: LegalMulticorpusEvaluationQuestion,
  routing?: RoutingQuestionResult,
): boolean {
  if (!routing) {
    return false;
  }

  if (
    question.questionType === 'ambiguous' ||
    question.questionType === 'out-of-scope'
  ) {
    return routing.predictedCorpusIds.length > 0;
  }

  return !setsEqual(
    corpusSet(question.goldCorpusIds),
    corpusSet(routing.predictedCorpusIds),
  );
}

export function classifyRetrievalFailure(
  question: LegalMulticorpusEvaluationQuestion,
  retrieval?: RetrievalQuestionResult,
  useRouted = true,
): boolean {
  if (
    !retrieval ||
    question.questionType === 'ambiguous' ||
    question.questionType === 'out-of-scope'
  ) {
    return false;
  }

  const metrics = useRouted ? retrieval.routed : retrieval.global;
  return metrics.recallAt20 === 0;
}

export function classifyRerankingFailure(
  question: LegalMulticorpusEvaluationQuestion,
  reranking?: RerankingQuestionResult,
): boolean {
  if (
    !reranking ||
    question.questionType === 'ambiguous' ||
    question.questionType === 'out-of-scope'
  ) {
    return false;
  }

  return reranking.rerankEffect === 'degraded';
}

export function classifyGenerationFailure(e2e?: E2EQuestionResult): boolean {
  if (!e2e || e2e.expectedAbstention) {
    return false;
  }

  const judge = e2e.routing.judge ?? e2e.baseline.judge;
  if (!judge) {
    return false;
  }

  return (
    judge.correctness < JUDGE_PASS_SCORE_THRESHOLD ||
    judge.completeness < JUDGE_PASS_SCORE_THRESHOLD ||
    judge.groundedness < JUDGE_PASS_SCORE_THRESHOLD
  );
}

export function classifyAbstentionFailure(e2e?: E2EQuestionResult): boolean {
  if (!e2e || !e2e.expectedAbstention) {
    return false;
  }

  const judge = e2e.routing.judge ?? e2e.baseline.judge;
  return judge ? !judge.abstentionCorrect : false;
}

export function classifyFailureStage(input: {
  question: LegalMulticorpusEvaluationQuestion;
  routing?: RoutingQuestionResult;
  retrieval?: RetrievalQuestionResult;
  reranking?: RerankingQuestionResult;
  e2e?: E2EQuestionResult;
}): FailureStage {
  if (classifyAbstentionFailure(input.e2e)) {
    return 'abstention';
  }

  if (classifyRoutingFailure(input.question, input.routing)) {
    return 'routing';
  }

  if (classifyRetrievalFailure(input.question, input.retrieval, true)) {
    return 'retrieval';
  }

  if (classifyRerankingFailure(input.question, input.reranking)) {
    return 'reranking';
  }

  if (classifyGenerationFailure(input.e2e)) {
    return 'generation';
  }

  return 'none';
}

export function analyzeErrors(
  questions: LegalMulticorpusEvaluationQuestion[],
  input: {
    routing?: RoutingQuestionResult[];
    retrieval?: RetrievalQuestionResult[];
    reranking?: RerankingQuestionResult[];
    e2e?: E2EQuestionResult[];
  },
): {
  byStage: Record<FailureStage, number>;
  results: Array<{ questionId: string; failureStage: FailureStage }>;
} {
  const byStage: Record<FailureStage, number> = {
    routing: 0,
    retrieval: 0,
    reranking: 0,
    generation: 0,
    abstention: 0,
    none: 0,
  };

  const routingById = new Map(input.routing?.map((result) => [result.questionId, result]));
  const retrievalById = new Map(input.retrieval?.map((result) => [result.questionId, result]));
  const rerankingById = new Map(input.reranking?.map((result) => [result.questionId, result]));
  const e2eById = new Map(input.e2e?.map((result) => [result.questionId, result]));

  const results = questions.map((question) => {
    const failureStage = classifyFailureStage({
      question,
      routing: routingById.get(question.id),
      retrieval: retrievalById.get(question.id),
      reranking: rerankingById.get(question.id),
      e2e: e2eById.get(question.id),
    });
    byStage[failureStage] += 1;
    return { questionId: question.id, failureStage };
  });

  return { byStage, results };
}
