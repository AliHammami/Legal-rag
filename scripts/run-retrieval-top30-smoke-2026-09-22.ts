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
import {
  loadQuestionEmbeddingCache,
} from '../src/evaluation/multicorpus/retrieval-depth-local-replay.js';
import {
  runRetrievalTop30SmokeQuestion,
  type RetrievalTop30SmokeQuestionResult,
} from '../src/evaluation/multicorpus/retrieval-top30-smoke-pipeline.js';
import {
  aggregateSmokeResults,
  buildGainAnalysisRows,
  classifyTop30SmokeDecision,
  type BaselineE2ERoutingMetrics,
} from '../src/evaluation/multicorpus/retrieval-top30-smoke-report.js';
import type {
  E2EQuestionResult,
  RoutingQuestionResult,
} from '../src/evaluation/multicorpus/types.js';
import type { QuestionQuotaAuditRecord } from '../src/evaluation/multicorpus/rerank-filter-quota-audit.js';
import { OpenAIService } from '../src/openai/openai.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { DEFAULT_RERANK_TOP_K } from '../src/reranking/constants.js';
import { JinaRerankerService } from '../src/reranking/jina-reranker.service.js';
import { RerankingPipelineModule } from '../src/reranking/reranking-pipeline.module.js';

const OUTPUT_DIR = join(
  'reports/evaluation/runs',
  'retrieval-top30-smoke-2026-09-22',
);
const EMBEDDING_CACHE = join(
  'reports/evaluation/runs',
  'retrieval-depth-benchmark-2026-09-22',
  'embedding-cache.json',
);
const DEPTH_BENCHMARK = join(
  'reports/evaluation/runs',
  'retrieval-depth-benchmark-2026-09-22',
  'benchmark.json',
);
const REFERENCE_E2E = join(
  'reports/evaluation/runs',
  '2026-09-21T16-59-10-310Z',
  'e2e.json',
);
const COHORT_BENCHMARK = DEPTH_BENCHMARK;
const ROUTING_RUN_ID = '2026-09-19T22-46-46-088Z';
const CONTEXT_LOSS_AUDIT = join(
  'reports/evaluation/runs',
  'context-loss-forensic-audit-2026-09-21',
  'audit.json',
);
const QUOTA_AUDIT = join(
  'reports/evaluation/runs',
  'multicorpus-rerank-filter-audit-quota-2026-09-21T15-22-47-287Z',
  'audit.json',
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

function loadBaselineFromReference(
  report: {
    results: E2EQuestionResult[];
  },
  questionIds: Set<string>,
): {
  metrics: BaselineE2ERoutingMetrics;
  byQuestion: Map<
    string,
    { correctness: number; completeness: number; sourceCoverage: number }
  >;
} {
  const results = report.results.filter((result) =>
    questionIds.has(result.questionId),
  );
  const byQuestion = new Map<
    string,
    { correctness: number; completeness: number; sourceCoverage: number }
  >();

  let correctness = 0;
  let completeness = 0;
  let groundedness = 0;
  let sourceRelevance = 0;
  let sourceCoverage = 0;
  let abstention = 0;
  let latency = 0;

  for (const result of results) {
    const routing = result.routing;
    correctness += routing.judge?.correctness ?? 0;
    completeness += routing.judge?.completeness ?? 0;
    groundedness += routing.judge?.groundedness ?? 0;
    sourceRelevance += routing.sourceJudge?.sourceRelevance ?? 0;
    sourceCoverage += routing.sourceJudge?.sourceCoverage ?? 0;
    abstention += routing.judge?.abstentionCorrect ? 1 : 0;
    latency += routing.profiling?.answerPipelineTotalMs ?? 0;
    byQuestion.set(result.questionId, {
      correctness: routing.judge?.correctness ?? 0,
      completeness: routing.judge?.completeness ?? 0,
      sourceCoverage: routing.sourceJudge?.sourceCoverage ?? 0,
    });
  }

  const count = results.length || 1;
  return {
    metrics: {
      questionCount: results.length,
      correctness: correctness / count,
      completeness: completeness / count,
      groundedness: groundedness / count,
      sourceRelevance: sourceRelevance / count,
      sourceCoverage: sourceCoverage / count,
      abstentionCorrectRate: abstention / count,
      avgLatencyMs: latency / count,
    },
    byQuestion,
  };
}

function buildReport(input: {
  config: Record<string, unknown>;
  smoke: ReturnType<typeof aggregateSmokeResults>;
  baseline: BaselineE2ERoutingMetrics;
  depthRecallAt20: number;
  decision: ReturnType<typeof classifyTop30SmokeDecision>;
  gainRows: ReturnType<typeof buildGainAnalysisRows>;
  apiCalls: Record<string, number>;
}): string {
  const delta = (value: number, base: number) => value - base;
  return `# Smoke retrievalTopK=30

## Configuration effective

\`\`\`json
${JSON.stringify(input.config, null, 2)}
\`\`\`

## Confirmations

- Cohorte: 61 questions (benchmark retrieval-depth 2026-09-22)
- Routing: replay identique au benchmark profondeur (0 appel LLM routing)
- Seule variable pipeline vs prod: retrievalTopK 20 -> 30
- Pas d E2E 500
- Embeddings: cache reutilise (${input.apiCalls.embedding} appels embedding)
- Jina rerank: ${input.apiCalls.reranking} appels
- Generation: ${input.apiCalls.generation} appels
- Judge routing: ${input.apiCalls.judge} appels

## Comparaison @20 reference vs smoke @30

| Metrique | E2E @20 (ref cohorte) | Smoke @30 | Delta |
|----------|----------------------:|----------:|------:|
| Gold recall retrieval | ${pct(input.depthRecallAt20)} | ${pct(input.smoke.retrievalGoldRecallAt30)} | ${pct(delta(input.smoke.retrievalGoldRecallAt30, input.depthRecallAt20))} |
| Gold dans final context | n/a ref | ${pct(input.smoke.finalContextGoldRecall)} | - |
| Full gold coverage context | n/a ref | ${pct(input.smoke.finalContextFullCoverageRate)} | - |
| Correctness | ${input.baseline.correctness.toFixed(2)} | ${input.smoke.correctness.toFixed(2)} | ${delta(input.smoke.correctness, input.baseline.correctness).toFixed(2)} |
| Completeness | ${input.baseline.completeness.toFixed(2)} | ${input.smoke.completeness.toFixed(2)} | ${delta(input.smoke.completeness, input.baseline.completeness).toFixed(2)} |
| Groundedness | ${input.baseline.groundedness.toFixed(2)} | ${input.smoke.groundedness.toFixed(2)} | ${delta(input.smoke.groundedness, input.baseline.groundedness).toFixed(2)} |
| Source relevance | ${input.baseline.sourceRelevance.toFixed(2)} | ${input.smoke.sourceRelevance.toFixed(2)} | ${delta(input.smoke.sourceRelevance, input.baseline.sourceRelevance).toFixed(2)} |
| Source coverage | ${input.baseline.sourceCoverage.toFixed(2)} | ${input.smoke.sourceCoverage.toFixed(2)} | ${delta(input.smoke.sourceCoverage, input.baseline.sourceCoverage).toFixed(2)} |
| Abstention correct | ${pct(input.baseline.abstentionCorrectRate)} | ${pct(input.smoke.abstentionCorrectRate)} | - |
| Latence moyenne (ms) | ${input.baseline.avgLatencyMs.toFixed(0)} | ${input.smoke.avgLatencyMs.toFixed(0)} | ${delta(input.smoke.avgLatencyMs, input.baseline.avgLatencyMs).toFixed(0)} |

## Gains marginaux retrieval (smoke @30)

| Nouveaux gold | @21-30 | dont top5 Jina | dont contexte final |
|---------------|-------:|---------------:|--------------------:|
| Articles | ${input.smoke.goldNewIn21To30Count} | ${input.smoke.goldNewIn21To30InRerankTop5} | ${input.smoke.goldNewIn21To30InFinalContext} |

## Analyse gold 21-30 (extrait)

${input.gainRows
  .slice(0, 15)
  .map(
    (row) =>
      `- ${row.questionId} ${row.gold.corpusId}:${row.gold.articleNumber} rank30=${row.rank30 ?? '-'} jina=${row.jinaRank ?? '-'} final=${row.inFinalContext} deltaCompleteness=${row.judgeDeltaCompleteness.toFixed(2)}`,
  )
  .join('\n')}

## Conclusion

**${input.decision.category}**

${input.decision.rationale}

**Prochaine etape:** ${input.decision.nextStep}
`;
}

interface ContextLossRecord {
  questionId: string;
  routedCorpusIds: string[];
}

function resolveRoutedCorpusIds(input: {
  questionId: string;
  quotaById: Map<string, QuestionQuotaAuditRecord>;
  routingById: Map<string, RoutingQuestionResult>;
  contextById: Map<string, ContextLossRecord>;
}): string[] {
  const fromQuota = input.quotaById.get(input.questionId)?.routedCorpusIds;
  if (fromQuota && fromQuota.length > 0) {
    return [...fromQuota].sort();
  }
  const predicted = input.routingById.get(input.questionId)?.predictedCorpusIds;
  if (predicted && predicted.length > 0) {
    return [...predicted].sort();
  }
  const fromContext = input.contextById.get(input.questionId)?.routedCorpusIds;
  return fromContext ? [...fromContext].sort() : [];
}

async function main(): Promise<void> {
  const [
    cohortBenchmark,
    depthBenchmark,
    referenceReport,
    contextRaw,
    routingRaw,
    quotaRaw,
  ] = await Promise.all([
    readFile(COHORT_BENCHMARK, 'utf-8'),
    readFile(DEPTH_BENCHMARK, 'utf-8'),
    readFile(REFERENCE_E2E, 'utf-8'),
    readFile(CONTEXT_LOSS_AUDIT, 'utf-8'),
    readFile(join('reports/evaluation/runs', ROUTING_RUN_ID, 'routing.json'), 'utf-8'),
    readFile(QUOTA_AUDIT, 'utf-8'),
  ]);

  const cohortIds = (JSON.parse(cohortBenchmark) as { dataset: { questionIds: string[] } })
    .dataset.questionIds;
  const depthSummary = JSON.parse(depthBenchmark) as {
    summary: { quota: { rows: Array<{ k: number; goldRecall: number }> } };
  };
  const depthRecallAt20 =
    depthSummary.summary.quota.rows.find((row) => row.k === 20)?.goldRecall ?? 0;

  const questions = (await loadMulticorpusEvaluationDataset(
    DEFAULT_MULTICORPUS_EVALUATION_DATASET_PATH,
  )).filter((question) => cohortIds.includes(question.id));

  if (questions.length !== cohortIds.length) {
    throw new Error(
      `Cohort mismatch: expected ${cohortIds.length}, loaded ${questions.length}`,
    );
  }

  if (!(await fileExists(EMBEDDING_CACHE))) {
    throw new Error(`Missing embedding cache: ${EMBEDDING_CACHE}`);
  }
  const embeddingCache = await loadQuestionEmbeddingCache(EMBEDDING_CACHE);

  const contextAudit = JSON.parse(contextRaw) as { records: ContextLossRecord[] };
  const routingReport = JSON.parse(routingRaw) as {
    results: RoutingQuestionResult[];
  };
  const quotaAudit = JSON.parse(quotaRaw) as {
    perQuestion: QuestionQuotaAuditRecord[];
  };
  const routingById = new Map(
    routingReport.results.map((result) => [result.questionId, result]),
  );
  const quotaById = new Map(
    quotaAudit.perQuestion.map((record) => [record.questionId, record]),
  );
  const contextById = new Map(
    contextAudit.records.map((record) => [record.questionId, record]),
  );
  const routedCorpusByQuestion = new Map(
    cohortIds.map((questionId) => [
      questionId,
      resolveRoutedCorpusIds({
        questionId,
        quotaById,
        routingById,
        contextById,
      }),
    ]),
  );
  const emptyRouting = cohortIds.filter(
    (id) => (routedCorpusByQuestion.get(id)?.length ?? 0) === 0,
  );
  if (emptyRouting.length > 0) {
    console.warn(
      `Warning: ${emptyRouting.length} questions without routed corpus replay:`,
      emptyRouting.join(', '),
    );
  }

  const baseConfig = buildDefaultModelConfiguration();
  const smokeConfig = {
    retrievalTopK: 30,
    rerankTopK: DEFAULT_RERANK_TOP_K,
    relativeScoreThreshold: baseConfig.relativeScoreThreshold,
    routingModel: baseConfig.routingModel,
  };

  console.log('Smoke configuration (only retrievalTopK differs from default 20):');
  console.log(
    JSON.stringify(
      {
        defaultRetrievalTopK: baseConfig.retrievalTopK,
        smokeConfig,
        routingReplay: {
          routingRunId: ROUTING_RUN_ID,
          quotaAudit: QUOTA_AUDIT,
          contextLossAudit: CONTEXT_LOSS_AUDIT,
          liveRoutingCalls: 0,
        },
        cohortQuestionCount: questions.length,
        embeddingCacheEntries: Object.keys(embeddingCache.embeddings).length,
      },
      null,
      2,
    ),
  );

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
  const apiCalls = {
    embedding: 0,
    reranking: 0,
    generation: 0,
    judge: 0,
    routing: 0,
  };

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
        console.log(`Cache hit ${question.id}`);
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
        config: smokeConfig,
        routedCorpusIds: routedCorpusByQuestion.get(question.id) ?? [],
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

  const questionIdSet = new Set(cohortIds);
  for (const result of results) {
    apiCalls.embedding += result.profiling.embeddingCalls;
    apiCalls.reranking += result.profiling.rerankingCalls;
    apiCalls.generation += result.profiling.generationCalls;
    apiCalls.routing += result.profiling.routingCalls;
    apiCalls.judge += 2;
  }

  const { metrics: baseline, byQuestion } = loadBaselineFromReference(
    JSON.parse(referenceReport) as { results: E2EQuestionResult[] },
    questionIdSet,
  );

  const smokeAgg = aggregateSmokeResults(results);
  const gainRows = buildGainAnalysisRows(results, byQuestion);
  const decision = classifyTop30SmokeDecision({
    smoke: smokeAgg,
    baseline,
    depthBenchmarkRecallAt20: depthRecallAt20,
  });

  const payload = {
    metadata: {
      timestamp: new Date().toISOString(),
      cohortQuestionIds: cohortIds,
      referenceE2ERun: REFERENCE_E2E,
      embeddingCachePath: EMBEDDING_CACHE,
      routingReplay: {
        routingRunId: ROUTING_RUN_ID,
        quotaAudit: QUOTA_AUDIT,
        contextLossAudit: CONTEXT_LOSS_AUDIT,
      },
      config: smokeConfig,
      apiCalls,
    },
    comparison: {
      baselineE2E20: baseline,
      depthBenchmarkRecallAt20: depthRecallAt20,
      smoke30: smokeAgg,
      delta: {
        retrievalGoldRecall: smokeAgg.retrievalGoldRecallAt30 - depthRecallAt20,
        correctness: smokeAgg.correctness - baseline.correctness,
        completeness: smokeAgg.completeness - baseline.completeness,
        groundedness: smokeAgg.groundedness - baseline.groundedness,
        sourceRelevance: smokeAgg.sourceRelevance - baseline.sourceRelevance,
        sourceCoverage: smokeAgg.sourceCoverage - baseline.sourceCoverage,
        avgLatencyMs: smokeAgg.avgLatencyMs - baseline.avgLatencyMs,
      },
    },
    decision,
    gainAnalysis: gainRows,
    results,
  };

  const report = buildReport({
    config: payload.metadata.config as Record<string, unknown>,
    smoke: smokeAgg,
    baseline,
    depthRecallAt20,
    decision,
    gainRows,
    apiCalls,
  });

  await writeFile(join(OUTPUT_DIR, 'smoke.json'), `${JSON.stringify(payload, null, 2)}\n`);
  await writeFile(
    join(OUTPUT_DIR, 'per-question.json'),
    `${JSON.stringify(results, null, 2)}\n`,
  );
  await writeFile(join(OUTPUT_DIR, 'REPORT.md'), report);

  console.log(`Decision: ${decision.category}`);
  console.log(`API calls: ${JSON.stringify(apiCalls)}`);
  console.log(`Output: ${OUTPUT_DIR}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
