import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { NestFactory } from '@nestjs/core';

import { GenerationPipelineModule } from '../src/generation/generation-pipeline.module.js';
import { RagGenerationService } from '../src/generation/rag-generation.service.js';
import { DEFAULT_MULTICORPUS_EVALUATION_DATASET_PATH } from '../src/evaluation/constants.js';
import { E2EJudgeModule } from '../src/evaluation/e2e-judge.module.js';
import { E2EJudgeService } from '../src/evaluation/e2e-judge.service.js';
import { E2ESourceJudgeModule } from '../src/evaluation/e2e-source-judge.module.js';
import { E2ESourceJudgeService } from '../src/evaluation/e2e-source-judge.service.js';
import { loadMulticorpusEvaluationDataset } from '../src/evaluation/load-multicorpus-dataset.js';
import { buildDefaultModelConfiguration } from '../src/evaluation/multicorpus/evaluation-config.js';
import { createJinaEvaluationRerankerService } from '../src/evaluation/multicorpus/jina-concurrency-limit.js';
import { loadQuestionEmbeddingCache } from '../src/evaluation/multicorpus/retrieval-depth-local-replay.js';
import {
  buildRetrievalTop30RegressionCohort,
  type RegressionCohortDefinition,
} from '../src/evaluation/multicorpus/retrieval-top30-regression-cohort.js';
import {
  aggregateRegressionMetrics,
  baselineFromE2E,
  buildTopK30VerificationRows,
  classifyRegressionDecision,
  detectRegressionFindings,
  type RegressionBaselineSnapshot,
} from '../src/evaluation/multicorpus/retrieval-top30-regression-report.js';
import {
  runRetrievalTop30SmokeQuestion,
  type RetrievalTop30SmokeQuestionResult,
} from '../src/evaluation/multicorpus/retrieval-top30-smoke-pipeline.js';
import type {
  E2EQuestionResult,
  RoutingQuestionResult,
} from '../src/evaluation/multicorpus/types.js';
import { OpenAIService } from '../src/openai/openai.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { DEFAULT_RERANK_TOP_K } from '../src/reranking/constants.js';
import { JinaRerankerService } from '../src/reranking/jina-reranker.service.js';
import { RerankingPipelineModule } from '../src/reranking/reranking-pipeline.module.js';

const OUTPUT_DIR = join(
  'reports/evaluation/runs',
  'retrieval-top30-regression-2026-09-22',
);
const EMBEDDING_CACHE = join(
  'reports/evaluation/runs',
  'retrieval-depth-benchmark-2026-09-22',
  'embedding-cache.json',
);
const REFERENCE_E2E = join(
  'reports/evaluation/runs',
  '2026-09-21T16-59-10-310Z',
  'e2e.json',
);
const SMOKE_CACHE_DIR = join(
  'reports/evaluation/runs',
  'retrieval-top30-smoke-2026-09-22',
  'e2e-cache',
);
const CONTEXT_LOSS_AUDIT = join(
  'reports/evaluation/runs',
  'context-loss-forensic-audit-2026-09-21',
  'audit.json',
);
const ROUTING_RUN = join(
  'reports/evaluation/runs',
  '2026-09-19T22-46-46-088Z',
  'routing.json',
);

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function loadSmokeReference(
  questionIds: string[],
): Promise<Map<string, RetrievalTop30SmokeQuestionResult>> {
  const map = new Map<string, RetrievalTop30SmokeQuestionResult>();
  for (const questionId of questionIds) {
    const path = join(SMOKE_CACHE_DIR, `${questionId}.json`);
    if (await fileExists(path)) {
      map.set(
        questionId,
        JSON.parse(await readFile(path, 'utf-8')) as RetrievalTop30SmokeQuestionResult,
      );
    }
  }
  return map;
}

function buildReport(input: {
  cohort: RegressionCohortDefinition;
  config: Record<string, unknown>;
  metrics: ReturnType<typeof aggregateRegressionMetrics>;
  findings: ReturnType<typeof detectRegressionFindings>;
  topkRows: ReturnType<typeof buildTopK30VerificationRows>;
  decision: ReturnType<typeof classifyRegressionDecision>;
  apiCalls: Record<string, number>;
  comparisonNotes: string[];
}): string {
  return `# Mini E2E regression retrievalTopK=30

## Cohorte (${input.cohort.questionIds.length} questions)

| questionId | categorie | rationale |
|------------|-----------|-----------|
${input.cohort.slots
  .map(
    (slot) =>
      `| ${slot.questionId} | ${slot.category} | ${slot.rationale} |`,
  )
  .join('\n')}

## Configuration

\`\`\`json
${JSON.stringify(input.config, null, 2)}
\`\`\`

- Routing: **live V3.1** (production)
- Seule variable vs prod actuelle: \`retrievalTopK=30\`

## Appels API

\`\`\`json
${JSON.stringify(input.apiCalls, null, 2)}
\`\`\`

## Metriques agregees

| Metrique | Valeur |
|----------|-------:|
| Gold recall retrieval @30 | ${pct(input.metrics.retrievalGoldRecall)} |
| Gold recall final context | ${pct(input.metrics.finalContextGoldRecall)} |
| Full gold coverage context | ${pct(input.metrics.finalContextFullCoverageRate)} |
| Corpus coverage multicorpus @30 | ${pct(input.metrics.multiCorpusCorpusCoverage)} |
| Correctness | ${input.metrics.correctness.toFixed(2)} |
| Completeness | ${input.metrics.completeness.toFixed(2)} |
| Groundedness | ${input.metrics.groundedness.toFixed(2)} |
| Source relevance | ${input.metrics.sourceRelevance.toFixed(2)} |
| Source coverage | ${input.metrics.sourceCoverage.toFixed(2)} |
| Abstention correct | ${pct(input.metrics.abstentionCorrectRate)} |

## Comparaison historique

${input.comparisonNotes.map((note) => `- ${note}`).join('\n')}

## Verification topK30 (q334, q367, q378)

| questionId | gold | rank@30 | Jina | final | correctness | completeness | groundedness | smoke completeness |
|------------|------|--------:|-----:|:-----:|------------:|-------------:|-------------:|-------------------:|
${input.topkRows
  .map(
    (row) =>
      `| ${row.questionId} | ${row.gold} | ${row.rank30 ?? '-'} | ${row.jinaRank ?? '-'} | ${row.inFinalContext} | ${row.correctness.toFixed(1)} | ${row.completeness.toFixed(1)} | ${row.groundedness.toFixed(1)} | ${row.smokeCompleteness.toFixed(1)} |`,
  )
  .join('\n')}

## Regressions detectees

${
  input.findings.length === 0
    ? 'Aucune.'
    : input.findings
        .map((finding) => `- **${finding.questionId}** (${finding.kind}): ${finding.detail}`)
        .join('\n')
}

## Decision

**${input.decision.category}**

${input.decision.rationale}

**Prochaine etape:** ${input.decision.nextStep}
`;
}

async function main(): Promise<void> {
  const [contextRaw, routingRaw, e2eRaw, datasetQuestions] = await Promise.all([
    readFile(CONTEXT_LOSS_AUDIT, 'utf-8'),
    readFile(ROUTING_RUN, 'utf-8'),
    readFile(REFERENCE_E2E, 'utf-8'),
    loadMulticorpusEvaluationDataset(DEFAULT_MULTICORPUS_EVALUATION_DATASET_PATH),
  ]);

  const e2eReport = JSON.parse(e2eRaw) as { results: E2EQuestionResult[] };
  const cohort = buildRetrievalTop30RegressionCohort({
    datasetQuestions,
    contextLossRecords: (JSON.parse(contextRaw) as { records: Array<{ questionId: string; questionType: string; primaryLossStage?: string }> })
      .records,
    e2eResults: e2eReport.results,
    routingResults: (JSON.parse(routingRaw) as { results: RoutingQuestionResult[] })
      .results,
    maxQuestions: 30,
  });

  const questions = datasetQuestions.filter((question) =>
    cohort.questionIds.includes(question.id),
  );
  if (questions.length !== cohort.questionIds.length) {
    throw new Error('Cohort questions missing from dataset');
  }

  const embeddingCache = await fileExists(EMBEDDING_CACHE)
    ? await loadQuestionEmbeddingCache(EMBEDDING_CACHE)
    : { embeddings: {} as Record<string, number[]> };

  const baseConfig = buildDefaultModelConfiguration();
  const runConfig = {
    retrievalTopK: 30,
    rerankTopK: DEFAULT_RERANK_TOP_K,
    relativeScoreThreshold: baseConfig.relativeScoreThreshold,
    routingModel: baseConfig.routingModel,
    liveRouting: true,
  };

  console.log(JSON.stringify({ cohort, runConfig }, null, 2));

  await mkdir(join(OUTPUT_DIR, 'e2e-cache'), { recursive: true });

  const rerankApp = await NestFactory.createApplicationContext(RerankingPipelineModule, {
    logger: ['error', 'warn'],
  });
  const generationApp = await NestFactory.createApplicationContext(GenerationPipelineModule, {
    logger: ['error', 'warn'],
  });
  const judgeApp = await NestFactory.createApplicationContext(E2EJudgeModule, {
    logger: ['error', 'warn'],
  });
  const sourceJudgeApp = await NestFactory.createApplicationContext(E2ESourceJudgeModule, {
    logger: ['error', 'warn'],
  });

  const results: RetrievalTop30SmokeQuestionResult[] = [];

  try {
    const prisma = rerankApp.get(PrismaService);
    const openAIService = rerankApp.get(OpenAIService);
    const rerankerService = createJinaEvaluationRerankerService(
      rerankApp.get(JinaRerankerService),
      { concurrencyLimit: 1 },
    );
    const generationService = generationApp.get(RagGenerationService);
    const judgeService = judgeApp.get(E2EJudgeService);
    const sourceJudgeService = sourceJudgeApp.get(E2ESourceJudgeService);

    for (const question of questions) {
      const cachePath = join(OUTPUT_DIR, 'e2e-cache', `${question.id}.json`);
      if (await fileExists(cachePath)) {
        results.push(
          JSON.parse(await readFile(cachePath, 'utf-8')) as RetrievalTop30SmokeQuestionResult,
        );
        console.log(`Cache ${question.id}`);
        continue;
      }

      const cachedEmbedding = embeddingCache.embeddings[question.id];
      const result = await runRetrievalTop30SmokeQuestion({
        prisma,
        openAIService,
        rerankerService,
        generationService,
        judgeService,
        sourceJudgeService,
        question,
        config: runConfig,
        liveRouting: true,
        cachedEmbedding,
      });

      results.push(result);
      await writeFile(cachePath, `${JSON.stringify(result, null, 2)}\n`);
      console.log(`Done ${question.id} (${results.length}/${questions.length})`);
    }
  } finally {
    await rerankApp.close();
    await generationApp.close();
    await judgeApp.close();
    await sourceJudgeApp.close();
  }

  const apiCalls = {
    embedding: 0,
    reranking: 0,
    generation: 0,
    judge: 0,
    routing: 0,
  };
  for (const result of results) {
    apiCalls.embedding += result.profiling.embeddingCalls;
    apiCalls.reranking += result.profiling.rerankingCalls;
    apiCalls.generation += result.profiling.generationCalls;
    apiCalls.routing += result.profiling.routingCalls;
    apiCalls.judge += 2;
  }

  const e2eById = new Map(
    e2eReport.results.map((result) => [result.questionId, result]),
  );
  const baselineByQuestion = new Map<string, RegressionBaselineSnapshot>();
  for (const questionId of cohort.questionIds) {
    const e2e = e2eById.get(questionId);
    if (e2e) {
      baselineByQuestion.set(questionId, baselineFromE2E(e2e));
    }
  }

  const smokeReference = await loadSmokeReference(['q334', 'q367', 'q378']);
  const metrics = aggregateRegressionMetrics(results);
  const findings = detectRegressionFindings({
    results,
    baselineByQuestion,
    smokeTop30ByQuestion: smokeReference,
  });
  const topkRows = buildTopK30VerificationRows(results, smokeReference);
  const decision = classifyRegressionDecision({
    findings,
    topk30Results: results.filter((result) =>
      ['q334', 'q367', 'q378'].includes(result.questionId),
    ),
  });

  const comparisonNotes = [
    'Baseline judge: bras routing E2E500 @20 (e2e.json) par questionId.',
    'Smoke top30: e2e-cache q334/q367/q378 pour reproductibilite gains 21-30.',
    'Embeddings: cache depth-benchmark quand disponible (sinon 1 appel/question).',
  ];

  const payload = {
    metadata: {
      timestamp: new Date().toISOString(),
      cohort,
      config: runConfig,
      referenceE2E: REFERENCE_E2E,
      smokeReferenceDir: SMOKE_CACHE_DIR,
      apiCalls,
    },
    metrics,
    findings,
    topk30Verification: topkRows,
    decision,
    baselineByQuestion: Object.fromEntries(baselineByQuestion),
    results,
  };

  const report = buildReport({
    cohort,
    config: runConfig,
    metrics,
    findings,
    topkRows,
    decision,
    apiCalls,
    comparisonNotes,
  });

  await writeFile(join(OUTPUT_DIR, 'regression.json'), `${JSON.stringify(payload, null, 2)}\n`);
  await writeFile(
    join(OUTPUT_DIR, 'per-question.json'),
    `${JSON.stringify(results, null, 2)}\n`,
  );
  await writeFile(join(OUTPUT_DIR, 'REPORT.md'), report);

  console.log(`Decision: ${decision.category}`);
  console.log(`Questions: ${cohort.questionIds.length}`);
  console.log(`API: ${JSON.stringify(apiCalls)}`);
  console.log(`Output: ${OUTPUT_DIR}`);

  if (decision.category === 'REGRESSION') {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
