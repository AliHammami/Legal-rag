import type {
  FinalRagValidationReport,
  ValidationCheck,
} from './final-rag-validation.types.js';
import { toPercent } from './metrics.js';

function formatCheck(label: string, check: ValidationCheck): string {
  if (check.status === 'pass') {
    return `✓ ${label}`;
  }

  if (check.status === 'skip') {
    return `- ${label} (skipped${check.reason ? `: ${check.reason}` : ''})`;
  }

  return `✗ ${label}\n  Reason: ${check.reason ?? 'unknown'}`;
}

export function formatFinalRagValidationReport(
  report: FinalRagValidationReport,
): string {
  const lines = [
    'RAG FINAL VALIDATION',
    '====================',
    '',
    'PROJECT',
    formatCheck('Tests', report.project.tests),
    formatCheck('Build', report.project.build),
    '',
    'DATASETS',
    formatCheck('Retrieval dataset', report.datasets.retrievalDataset),
    formatCheck('E2E dataset', report.datasets.e2eDataset),
  ];

  if (report.datasets.e2eDatasetSummary) {
    lines.push(
      `  ${report.datasets.e2eDatasetSummary.questionCount} questions`,
      `  ${report.datasets.e2eDatasetSummary.normalQuestionCount} normal`,
      `  ${report.datasets.e2eDatasetSummary.abstentionQuestionCount} abstention`,
    );
  }

  lines.push(
    '',
    'PIPELINE',
    formatCheck('Ingestion', report.pipeline.ingestion),
    formatCheck('Chunking', report.pipeline.chunking),
    formatCheck('Embeddings', report.pipeline.embeddings),
    formatCheck('PostgreSQL / pgvector', report.pipeline.postgresqlPgvector),
    formatCheck('Retrieval', report.pipeline.retrieval),
    formatCheck('Jina reranking', report.pipeline.jinaReranking),
    formatCheck('Dynamic context filtering', report.pipeline.dynamicContextFiltering),
    formatCheck('Generation', report.pipeline.generation),
    '',
    'RETRIEVAL',
  );

  if (report.retrieval.metrics) {
    const metrics = report.retrieval.metrics;
    lines.push(
      formatCheck('Recall@20', report.retrieval.status),
      formatCheck('Recall@5', report.retrieval.status),
      formatCheck('MRR', report.retrieval.status),
      `  Recall@20 Vector: ${toPercent(metrics.recallAt20Vector).toFixed(1)}%`,
      `  Recall@5 Vector:  ${toPercent(metrics.recallAt5Vector).toFixed(1)}%`,
      `  Recall@5 Jina:    ${toPercent(metrics.recallAt5Jina).toFixed(1)}%`,
      `  MRR Vector:       ${metrics.mrrVector.toFixed(3)}`,
      `  MRR Jina:         ${metrics.mrrJina.toFixed(3)}`,
      `  Jina Recall@5 delta: ${metrics.recallAt5ImprovementPoints >= 0 ? '+' : ''}${metrics.recallAt5ImprovementPoints.toFixed(1)} pts`,
      `  Jina MRR delta:      ${metrics.mrrImprovement >= 0 ? '+' : ''}${metrics.mrrImprovement.toFixed(3)}`,
      `  Embedding avg:    ${Math.round(metrics.averageEmbeddingMs)} ms`,
      `  pgvector avg:     ${Math.round(metrics.averageVectorSearchMs)} ms`,
      `  Jina avg:         ${Math.round(metrics.averageJinaRerankingMs)} ms`,
      `  Total avg:        ${Math.round(metrics.averageTotalMs)} ms`,
    );
  } else {
    lines.push(formatCheck('Metrics', report.retrieval.status));
  }

  lines.push(
    '',
    'E2E',
    formatCheck('Snapshot', report.e2e.snapshot),
    formatCheck('Correctness', report.e2e.judge),
    formatCheck('Completeness', report.e2e.judge),
    formatCheck('Groundedness', report.e2e.judge),
    formatCheck('Abstention', report.e2e.judge),
    formatCheck('Quality report', report.e2e.qualityReport),
  );

  if (report.e2e.metrics) {
    const metrics = report.e2e.metrics;
    lines.push(
      `  Correctness avg: ${metrics.averageCorrectness.toFixed(2)} / 4`,
      `  Completeness avg: ${metrics.averageCompleteness.toFixed(2)} / 4`,
      `  Groundedness avg: ${metrics.averageGroundedness.toFixed(2)} / 4`,
      `  Correctness >= 3: ${metrics.correctnessPassRate}%`,
      `  Completeness >= 3: ${metrics.completenessPassRate}%`,
      `  Groundedness >= 3: ${metrics.groundednessPassRate}%`,
      `  Abstention accuracy: ${metrics.abstentionAccuracy}%`,
      `  Problematic questions: ${metrics.problematicQuestionCount}`,
      `  Avg latency: ${Math.round(metrics.averageTotalLatencyMs)} ms`,
      `  Avg context: ${Math.round(metrics.averageContextCharacters)} chars`,
      `  Avg filtered chunks: ${metrics.averageFilteredContextChunks.toFixed(2)}`,
    );
  }

  lines.push(
    '',
    'SOURCES',
    formatCheck('Snapshot', report.sources.snapshot),
    formatCheck('Source relevance', report.sources.report),
    formatCheck('Source coverage', report.sources.report),
  );

  if (report.sources.metrics) {
    const metrics = report.sources.metrics;
    lines.push(
      `  Source relevance avg: ${metrics.averageSourceRelevance.toFixed(2)} / 4`,
      `  Source coverage avg: ${metrics.averageSourceCoverage.toFixed(2)} / 4`,
      `  Source relevance >= 3: ${metrics.sourceRelevancePassRate}%`,
      `  Source coverage >= 3: ${metrics.sourceCoveragePassRate}%`,
      `  Low source relevance: ${metrics.lowSourceRelevanceQuestionIds.join(', ') || '(none)'}`,
    );
  }

  lines.push(
    '',
    'ARTIFACTS',
    formatCheck('E2E results', report.artifacts.e2eResults),
    formatCheck('E2E judged results', report.artifacts.e2eEvaluated),
    formatCheck('E2E quality report', report.artifacts.e2eQualityReport),
    formatCheck('Source evaluated results', report.artifacts.sourcesEvaluated),
    formatCheck('Source report', report.artifacts.sourceReport),
    '',
    'LIMITATIONS',
    formatCheck('Benchmark-specific metrics documented', report.limitations.benchmarkSpecificMetrics),
    formatCheck('Same-model judge limitation documented', report.limitations.sameModelJudgeBias),
    formatCheck('40% context threshold documented', report.limitations.contextThreshold40Percent),
    formatCheck(`Small corpus (${report.corpusChunkCount} chunks) / HNSW decision documented`, report.limitations.smallCorpusNoHnsw),
    formatCheck('Jina no global metric gain documented', report.limitations.jinaNoGlobalMetricGain),
    '',
    'STATUS',
    `RAG VALIDATION: ${report.status}`,
  );

  if (report.failures.length > 0) {
    lines.push('', 'FAILURES', ...report.failures.map((failure) => `- ${failure}`));
  }

  return lines.join('\n');
}
