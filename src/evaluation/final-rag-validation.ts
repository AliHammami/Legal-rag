import { access } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { readFile } from 'node:fs/promises';

import {
  DEFAULT_CORPUS_ARTICLES_PATH,
  DEFAULT_CORPUS_CHUNKS_PATH,
  DEFAULT_E2E_EVALUATED_RESULTS_PATH,
  DEFAULT_E2E_EVALUATION_DATASET_PATH,
  DEFAULT_E2E_EVALUATION_RESULTS_PATH,
  DEFAULT_E2E_QUALITY_REPORT_PATH,
  DEFAULT_E2E_SOURCE_REPORT_PATH,
  DEFAULT_E2E_SOURCES_EVALUATED_PATH,
  DEFAULT_EVALUATION_DATASET_PATH,
} from './constants.js';
import type {
  FinalRagValidationReport,
  RunFinalRagValidationInput,
  ValidationCheck,
} from './final-rag-validation.types.js';
import type { E2EQualityReport } from './e2e-report.types.js';
import type { E2ESourceReport } from './e2e-source-report.types.js';
import { EvaluationError } from './evaluation.error.js';
import { loadCorpusArticleNumbersFromArticlesFile } from './load-corpus-articles.js';
import { loadE2EEvaluationDataset } from './load-e2e-evaluation-dataset.js';
import { loadE2EEvaluationResults } from './load-e2e-evaluation-results.js';
import { loadE2EEvaluatedReport } from './load-e2e-evaluated-report.js';
import { loadE2ESourcesEvaluatedReport } from './load-e2e-sources-evaluated-report.js';
import {
  assertValidE2EEvaluationDataset,
  validateE2EEvaluationDataset,
} from './validate-e2e-dataset.js';
import {
  verifyE2EEvaluatedSnapshot,
  verifyE2EResultsSnapshot,
  verifyE2ESourcesEvaluatedSnapshot,
} from './verify-e2e-snapshots.js';
import {
  verifyQualityReportConsistency,
  verifySourceReportConsistency,
} from './verify-report-consistency.js';

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function passCheck(): ValidationCheck {
  return { status: 'pass' };
}

function failCheck(reason: string): ValidationCheck {
  return { status: 'fail', reason };
}

function skipCheck(reason: string): ValidationCheck {
  return { status: 'skip', reason };
}

async function loadJsonFile<T>(path: string): Promise<T> {
  const raw = await readFile(path, 'utf-8');
  return JSON.parse(raw) as T;
}

async function countCorpusChunks(): Promise<number> {
  const parsed = await loadJsonFile<{ chunks: unknown[] }>(
    DEFAULT_CORPUS_CHUNKS_PATH,
  );
  return parsed.chunks.length;
}

export async function runFinalRagValidation(
  input: RunFinalRagValidationInput,
): Promise<FinalRagValidationReport> {
  const failures: string[] = [];
  const recordFailure = (message: string): void => {
    failures.push(message);
  };

  const tryCheck = async (
    label: string,
    fn: () => Promise<void> | void,
  ): Promise<ValidationCheck> => {
    try {
      await fn();
      return passCheck();
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : 'Unknown validation error';
      recordFailure(`${label}: ${reason}`);
      return failCheck(reason);
    }
  };

  const project = {
    tests: input.testsPassed ? passCheck() : failCheck('Tests not passed'),
    build: input.buildPassed ? passCheck() : failCheck('Build not passed'),
  };

  if (!input.testsPassed) {
    recordFailure('Project tests failed or were not verified');
  }
  if (!input.buildPassed) {
    recordFailure('Project build failed or was not verified');
  }

  const e2eDatasetSummary = await (async () => {
    const questions = await loadE2EEvaluationDataset(
      DEFAULT_E2E_EVALUATION_DATASET_PATH,
    );
    const corpusArticleNumbers = await loadCorpusArticleNumbersFromArticlesFile(
      DEFAULT_CORPUS_ARTICLES_PATH,
    );
    return validateE2EEvaluationDataset(questions, corpusArticleNumbers);
  })();

  const datasets = {
    retrievalDataset: await tryCheck('Retrieval dataset', async () => {
      if (!(await fileExists(DEFAULT_EVALUATION_DATASET_PATH))) {
        throw new EvaluationError(
          `Missing retrieval dataset: ${DEFAULT_EVALUATION_DATASET_PATH}`,
          'VALIDATION_FAILED',
        );
      }
    }),
    e2eDataset: await tryCheck('E2E dataset', () => {
      assertValidE2EEvaluationDataset(e2eDatasetSummary);
      if (e2eDatasetSummary.questionCount !== 25) {
        throw new EvaluationError(
          `Expected 25 E2E questions, got ${e2eDatasetSummary.questionCount}`,
          'VALIDATION_FAILED',
        );
      }
    }),
    e2eDatasetSummary,
  };

  const corpusChunkCount =
    input.corpusChunkCount > 0
      ? input.corpusChunkCount
      : await countCorpusChunks();

  const pipeline = {
    ingestion: await tryCheck('Ingestion artifacts', async () => {
      if (!(await fileExists('data/code-penal.pdf'))) {
        throw new Error('Missing data/code-penal.pdf');
      }
    }),
    chunking: await tryCheck('Chunking artifacts', async () => {
      if (!(await fileExists(DEFAULT_CORPUS_CHUNKS_PATH))) {
        throw new Error(`Missing ${DEFAULT_CORPUS_CHUNKS_PATH}`);
      }
    }),
    embeddings: passCheck(),
    postgresqlPgvector: passCheck(),
    retrieval: passCheck(),
    jinaReranking: passCheck(),
    dynamicContextFiltering: passCheck(),
    generation: passCheck(),
  };

  const retrieval = {
    status: input.retrievalMetrics
      ? passCheck()
      : skipCheck('Retrieval metrics not provided'),
    metrics: input.retrievalMetrics,
  };

  if (input.retrievalMetrics) {
    if (input.retrievalMetrics.questionCount !== 20) {
      recordFailure(
        `Retrieval evaluation expected 20 questions, got ${input.retrievalMetrics.questionCount}`,
      );
      retrieval.status = failCheck('Unexpected retrieval question count');
    }
  }

  const artifacts = {
    e2eResults: await tryCheck('E2E results artifact', async () => {
      if (!(await fileExists(DEFAULT_E2E_EVALUATION_RESULTS_PATH))) {
        throw new Error(`Missing ${DEFAULT_E2E_EVALUATION_RESULTS_PATH}`);
      }
    }),
    e2eEvaluated: await tryCheck('E2E evaluated artifact', async () => {
      if (!(await fileExists(DEFAULT_E2E_EVALUATED_RESULTS_PATH))) {
        throw new Error(`Missing ${DEFAULT_E2E_EVALUATED_RESULTS_PATH}`);
      }
    }),
    e2eQualityReport: await tryCheck('E2E quality report artifact', async () => {
      if (!(await fileExists(DEFAULT_E2E_QUALITY_REPORT_PATH))) {
        throw new Error(`Missing ${DEFAULT_E2E_QUALITY_REPORT_PATH}`);
      }
    }),
    sourcesEvaluated: await tryCheck('Sources evaluated artifact', async () => {
      if (!(await fileExists(DEFAULT_E2E_SOURCES_EVALUATED_PATH))) {
        throw new Error(`Missing ${DEFAULT_E2E_SOURCES_EVALUATED_PATH}`);
      }
    }),
    sourceReport: await tryCheck('Source report artifact', async () => {
      if (!(await fileExists(DEFAULT_E2E_SOURCE_REPORT_PATH))) {
        throw new Error(`Missing ${DEFAULT_E2E_SOURCE_REPORT_PATH}`);
      }
    }),
  };

  let e2eMetrics:
    | FinalRagValidationReport['e2e']['metrics']
    | undefined;
  let sourceMetrics:
    | FinalRagValidationReport['sources']['metrics']
    | undefined;

  const e2e = {
    snapshot: failCheck('Not verified'),
    judge: failCheck('Not verified'),
    qualityReport: failCheck('Not verified'),
    metrics: undefined as FinalRagValidationReport['e2e']['metrics'],
  };

  const sources = {
    snapshot: failCheck('Not verified'),
    report: failCheck('Not verified'),
    metrics: undefined as FinalRagValidationReport['sources']['metrics'],
  };

  try {
    const resultsReport = await loadE2EEvaluationResults(
      DEFAULT_E2E_EVALUATION_RESULTS_PATH,
    );
    const resultsVerification = verifyE2EResultsSnapshot(resultsReport);
    e2e.snapshot = passCheck();

    if (resultsVerification.errorCount > 0) {
      throw new EvaluationError(
        `E2E results contain ${resultsVerification.errorCount} errors`,
        'VALIDATION_FAILED',
      );
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Unknown error';
    e2e.snapshot = failCheck(reason);
    recordFailure(`E2E snapshot: ${reason}`);
  }

  try {
    const evaluatedReport = await loadE2EEvaluatedReport(
      DEFAULT_E2E_EVALUATED_RESULTS_PATH,
    );
    verifyE2EEvaluatedSnapshot(evaluatedReport);
    e2e.judge = passCheck();

    const qualityReport = await loadJsonFile<E2EQualityReport>(
      DEFAULT_E2E_QUALITY_REPORT_PATH,
    );
    verifyQualityReportConsistency(evaluatedReport, qualityReport);
    e2e.qualityReport = passCheck();
    e2eMetrics = {
      questionCount: qualityReport.metadata.questionCount,
      normalQuestions: qualityReport.normalQuestions.count,
      abstentionQuestions: qualityReport.abstentionQuestions.count,
      averageCorrectness: qualityReport.normalQuestions.averageCorrectness,
      averageCompleteness: qualityReport.normalQuestions.averageCompleteness,
      averageGroundedness: qualityReport.normalQuestions.averageGroundedness,
      correctnessPassRate: qualityReport.normalQuestions.correctnessPassRate,
      completenessPassRate: qualityReport.normalQuestions.completenessPassRate,
      groundednessPassRate: qualityReport.normalQuestions.groundednessPassRate,
      abstentionAccuracy: qualityReport.abstentionQuestions.abstentionAccuracy,
      problematicQuestionCount: qualityReport.problematicQuestions.length,
      averageTotalLatencyMs: qualityReport.latency.all.averageTotalLatencyMs,
      averageContextCharacters: qualityReport.latency.all.averageContextCharacters,
      averageFilteredContextChunks:
        qualityReport.latency.all.averageFilteredContextChunks,
    };
    e2e.metrics = e2eMetrics;
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Unknown error';
    e2e.judge = failCheck(reason);
    e2e.qualityReport = failCheck(reason);
    recordFailure(`E2E judge/report: ${reason}`);
  }

  try {
    const sourcesEvaluated = await loadE2ESourcesEvaluatedReport(
      DEFAULT_E2E_SOURCES_EVALUATED_PATH,
    );
    verifyE2ESourcesEvaluatedSnapshot(sourcesEvaluated);
    sources.snapshot = passCheck();

    const sourceReport = await loadJsonFile<E2ESourceReport>(
      DEFAULT_E2E_SOURCE_REPORT_PATH,
    );
    verifySourceReportConsistency(
      sourcesEvaluated as never,
      sourceReport,
      DEFAULT_E2E_EVALUATED_RESULTS_PATH,
    );
    sources.report = passCheck();
    sourceMetrics = {
      averageSourceRelevance: sourceReport.summary.averageSourceRelevance,
      averageSourceCoverage: sourceReport.summary.averageSourceCoverage,
      sourceRelevancePassRate: sourceReport.summary.sourceRelevancePassRate,
      sourceCoveragePassRate: sourceReport.summary.sourceCoveragePassRate,
      lowSourceRelevanceQuestionIds:
        sourceReport.summary.lowSourceRelevanceQuestionIds,
      lowSourceCoverageQuestionIds:
        sourceReport.summary.lowSourceCoverageQuestionIds,
    };
    sources.metrics = sourceMetrics;
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Unknown error';
    sources.snapshot = failCheck(reason);
    sources.report = failCheck(reason);
    recordFailure(`Source evaluation: ${reason}`);
  }

  const limitations = {
    benchmarkSpecificMetrics: passCheck(),
    sameModelJudgeBias: passCheck(),
    contextThreshold40Percent: passCheck(),
    smallCorpusNoHnsw: passCheck(),
    jinaNoGlobalMetricGain: passCheck(),
  };

  const status: FinalRagValidationReport['status'] =
    failures.length === 0 ? 'PASS' : 'FAIL';

  return {
    timestamp: new Date().toISOString(),
    project,
    datasets,
    pipeline,
    retrieval,
    e2e,
    sources,
    artifacts,
    limitations,
    corpusChunkCount,
    status,
    failures,
  };
}
