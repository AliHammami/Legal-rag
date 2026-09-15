import { computeRelativeScore } from '../generation/dynamic-context-filter.js';
import type { AnswerQuestionResult } from '../generation/types.js';
import type {
  BuildE2EQuestionResultInput,
  E2EChunkSnapshot,
  E2EQuestionResult,
  E2EQuestionResultError,
  E2EQuestionResultSuccess,
  E2ESourceSnapshot,
  E2ETimingsSnapshot,
} from './e2e-evaluation.types.js';
import type { E2EEvaluationQuestion } from './types.js';

function toRetrievedChunkSnapshots(
  chunks: BuildE2EQuestionResultInput['pipelineResult']['candidates'],
): E2EChunkSnapshot[] {
  return chunks.map((chunk, index) => ({
    rank: index + 1,
    chunkId: chunk.chunkId,
    articleNumber: chunk.articleNumber,
    distance: chunk.distance,
  }));
}

function toRerankedChunkSnapshots(
  chunks: BuildE2EQuestionResultInput['pipelineResult']['reranked'],
): E2EChunkSnapshot[] {
  const bestScore = chunks[0]?.rerankScore ?? 0;

  return chunks.map((chunk, index) => ({
    rank: index + 1,
    chunkId: chunk.chunkId,
    articleNumber: chunk.articleNumber,
    distance: chunk.distance,
    score: chunk.rerankScore,
    relativeScore:
      chunk.rerankScore === undefined
        ? undefined
        : computeRelativeScore(chunk.rerankScore, bestScore),
  }));
}

function toFilteredContextChunkSnapshots(
  sources: BuildE2EQuestionResultInput['pipelineResult']['sources'],
  reranked: BuildE2EQuestionResultInput['pipelineResult']['reranked'],
): E2EChunkSnapshot[] {
  const bestScore = reranked[0]?.rerankScore ?? 0;

  return sources.map((source, index) => ({
    rank: index + 1,
    chunkId: source.chunkId,
    articleNumber: source.articleNumber,
    distance: source.chunk.distance,
    score: source.chunk.rerankScore,
    relativeScore:
      source.chunk.rerankScore === undefined
        ? undefined
        : computeRelativeScore(source.chunk.rerankScore, bestScore),
  }));
}

function toSourceSnapshots(
  sources: BuildE2EQuestionResultInput['pipelineResult']['sources'],
): E2ESourceSnapshot[] {
  return sources.map((source) => ({
    sourceId: source.sourceId,
    chunkId: source.chunkId,
    articleNumber: source.articleNumber,
    chunkIndex: source.chunkIndex,
  }));
}

function toTimingsSnapshot(
  profiling: BuildE2EQuestionResultInput['pipelineResult']['profiling'],
): E2ETimingsSnapshot {
  return {
    embeddingMs: profiling.embeddingMs,
    vectorSearchMs: profiling.vectorSearchMs,
    jinaRerankingMs: profiling.jinaRerankingMs,
    mappingMs: profiling.mappingMs,
    retrievalTotalMs: profiling.totalMs,
    contextFilteringMs: profiling.contextFilteringMs,
    contextBuilderMs: profiling.contextBuilderMs,
    generationMs: profiling.generationMs,
    answerPipelineTotalMs: profiling.answerPipelineTotalMs,
  };
}

export function buildE2EQuestionResultSuccess(
  input: BuildE2EQuestionResultInput,
): E2EQuestionResultSuccess {
  const { question, pipelineResult } = input;

  return {
    status: 'success',
    id: question.id,
    question: question.question,
    expectedAbstention: question.expectedAbstention,
    goldArticles: question.goldArticles,
    referenceAnswer: question.referenceAnswer,
    generatedAnswer: pipelineResult.answer,
    context: pipelineResult.context,
    retrievedChunks: toRetrievedChunkSnapshots(pipelineResult.candidates),
    rerankedChunks: toRerankedChunkSnapshots(pipelineResult.reranked),
    filteredContextChunks: toFilteredContextChunkSnapshots(
      pipelineResult.sources,
      pipelineResult.reranked,
    ),
    contextFiltering: pipelineResult.contextFiltering,
    sources: toSourceSnapshots(pipelineResult.sources),
    timings: toTimingsSnapshot(pipelineResult.profiling),
    rerankStatus: pipelineResult.rerankStatus,
  };
}

export function buildE2EQuestionResultFromAnswerQuestion(
  question: E2EEvaluationQuestion,
  pipelineResult: AnswerQuestionResult,
): E2EQuestionResultSuccess {
  return buildE2EQuestionResultSuccess({ question, pipelineResult });
}

export function buildE2EQuestionResultError(
  question: E2EEvaluationQuestion,
  error: unknown,
): E2EQuestionResultError {
  if (error instanceof Error) {
    return {
      status: 'error',
      id: question.id,
      question: question.question,
      expectedAbstention: question.expectedAbstention,
      goldArticles: question.goldArticles,
      referenceAnswer: question.referenceAnswer,
      error: {
        message: error.message,
        code: error.name,
      },
    };
  }

  return {
    status: 'error',
    id: question.id,
    question: question.question,
    expectedAbstention: question.expectedAbstention,
    goldArticles: question.goldArticles,
    referenceAnswer: question.referenceAnswer,
    error: {
      message: 'Unknown error during E2E evaluation',
      code: 'UNKNOWN_ERROR',
    },
  };
}

export function buildE2EQuestionResult(
  question: E2EEvaluationQuestion,
  pipelineResult: AnswerQuestionResult,
): E2EQuestionResult {
  return buildE2EQuestionResultFromAnswerQuestion(question, pipelineResult);
}
