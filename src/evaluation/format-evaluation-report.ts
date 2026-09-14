import { average, toPercent } from './metrics.js';
import type {
  EvaluationSummary,
  QuestionEvaluationResult,
  RetrievalEvaluationReport,
} from './types.js';

function formatHit(value: 0 | 1): string {
  return value === 1 ? 'HIT' : 'MISS';
}

function formatArticleList(articleNumbers: string[], limit: number): string[] {
  return articleNumbers.slice(0, limit).map((articleNumber, index) => {
    return `${index + 1}. ${articleNumber}`;
  });
}

export function formatQuestionEvaluationResult(
  result: QuestionEvaluationResult,
): string {
  const vectorTop5Articles = result.vectorTop5.map((chunk) => chunk.articleNumber);
  const jinaTop5Articles = result.jinaTop5.map((chunk) => chunk.articleNumber);

  return [
    `[${result.question.id}]`,
    'Question:',
    result.question.question,
    '',
    'Gold:',
    result.question.goldArticles.join(', '),
    '',
    'Vector Top 5:',
    ...formatArticleList(vectorTop5Articles, 5),
    '',
    'Jina Top 5:',
    ...formatArticleList(jinaTop5Articles, 5),
    '',
    'Metrics:',
    `Recall@20 Vector: ${formatHit(result.metrics.recallAt20Vector)}`,
    `Recall@5 Vector:  ${formatHit(result.metrics.recallAt5Vector)}`,
    `Recall@5 Jina:    ${formatHit(result.metrics.recallAt5Jina)}`,
    '',
    `MRR Vector: ${result.metrics.mrrVector.toFixed(3)}`,
    `MRR Jina:   ${result.metrics.mrrJina.toFixed(3)}`,
    `Rerank status: ${result.rerankStatus}`,
  ].join('\n');
}

export function buildEvaluationSummary(
  results: QuestionEvaluationResult[],
): EvaluationSummary {
  const recallAt20Vector = average(
    results.map((result) => result.metrics.recallAt20Vector),
  );
  const recallAt5Vector = average(
    results.map((result) => result.metrics.recallAt5Vector),
  );
  const recallAt5Jina = average(
    results.map((result) => result.metrics.recallAt5Jina),
  );
  const mrrVector = average(results.map((result) => result.metrics.mrrVector));
  const mrrJina = average(results.map((result) => result.metrics.mrrJina));

  return {
    questionCount: results.length,
    recallAt20Vector,
    recallAt5Vector,
    recallAt5Jina,
    mrrVector,
    mrrJina,
    recallAt5ImprovementPoints: toPercent(recallAt5Jina - recallAt5Vector),
    mrrImprovement: mrrJina - mrrVector,
    averageEmbeddingMs: average(
      results.map((result) => result.profiling.embeddingMs),
    ),
    averageVectorSearchMs: average(
      results.map((result) => result.profiling.vectorSearchMs),
    ),
    averageJinaRerankingMs: average(
      results.map((result) => result.profiling.jinaRerankingMs),
    ),
    averageTotalMs: average(
      results.map((result) => result.profiling.totalMs),
    ),
  };
}

export function formatEvaluationSummary(summary: EvaluationSummary): string {
  const improvementSign = summary.recallAt5ImprovementPoints >= 0 ? '+' : '';
  const mrrSign = summary.mrrImprovement >= 0 ? '+' : '';

  return [
    '# RAG RETRIEVAL EVALUATION',
    '',
    `Questions: ${summary.questionCount}`,
    '',
    'VECTOR',
    `Recall@20: ${toPercent(summary.recallAt20Vector).toFixed(1)}%`,
    `Recall@5:  ${toPercent(summary.recallAt5Vector).toFixed(1)}%`,
    `MRR:        ${summary.mrrVector.toFixed(3)}`,
    '',
    'VECTOR + JINA',
    `Recall@5:  ${toPercent(summary.recallAt5Jina).toFixed(1)}%`,
    `MRR:        ${summary.mrrJina.toFixed(3)}`,
    '',
    'IMPROVEMENT WITH JINA',
    `Recall@5: ${improvementSign}${summary.recallAt5ImprovementPoints.toFixed(1)} pts`,
    `MRR:       ${mrrSign}${summary.mrrImprovement.toFixed(3)}`,
    '',
    'LATENCY',
    `Embedding:     ${Math.round(summary.averageEmbeddingMs)} ms average`,
    `pgvector:      ${Math.round(summary.averageVectorSearchMs)} ms average`,
    `Jina:          ${Math.round(summary.averageJinaRerankingMs)} ms average`,
    `Total:         ${Math.round(summary.averageTotalMs)} ms average`,
  ].join('\n');
}

export function formatRetrievalEvaluationReport(
  report: RetrievalEvaluationReport,
): string {
  const sections = report.results.map((result) =>
    formatQuestionEvaluationResult(result),
  );

  return [...sections, formatEvaluationSummary(report.summary)].join('\n\n');
}

export function findRankingImprovements(
  results: QuestionEvaluationResult[],
): QuestionEvaluationResult[] {
  return results.filter(
    (result) => result.metrics.mrrJina > result.metrics.mrrVector,
  );
}

export function findRankingDegradations(
  results: QuestionEvaluationResult[],
): QuestionEvaluationResult[] {
  return results.filter(
    (result) => result.metrics.mrrJina < result.metrics.mrrVector,
  );
}
