import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { NestFactory } from '@nestjs/core';

import { EMBEDDING_DIMENSIONS } from '../src/embeddings/constants.js';
import { DEFAULT_MULTICORPUS_EVALUATION_DATASET_PATH } from '../src/evaluation/constants.js';
import { loadMulticorpusEvaluationDataset } from '../src/evaluation/load-multicorpus-dataset.js';
import {
  aggregateRetrievalDepth,
  buildCorpusNeighborWindow,
  buildQuestionRetrievalDepthResult,
  classifyDepthDecision,
  computeMarginalGains,
  goldRankDetailForStrategy,
  RETRIEVAL_DEPTH_K_VALUES,
  summarizeMarginalGoldBands,
  type GoldRankDetail,
  type RetrievalDepthAggregateRow,
} from '../src/evaluation/multicorpus/retrieval-depth-benchmark.js';
import {
  loadQuestionEmbeddingCache,
  replayRetrievalDepthForQuestion,
  type QuestionEmbeddingCacheFile,
} from '../src/evaluation/multicorpus/retrieval-depth-local-replay.js';
import type { QuestionQuotaAuditRecord } from '../src/evaluation/multicorpus/rerank-filter-quota-audit.js';
import type { RoutingQuestionResult } from '../src/evaluation/multicorpus/types.js';
import { OpenAIService } from '../src/openai/openai.service.js';
import { validateQuestion } from '../src/retrieval/validate-search-input.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { RetrievalPipelineModule } from '../src/retrieval/retrieval-pipeline.module.js';

const OUTPUT_DIR = join(
  'reports/evaluation/runs',
  'retrieval-depth-benchmark-2026-09-22',
);
const EMBEDDING_CACHE_PATH = join(OUTPUT_DIR, 'embedding-cache.json');
const CONTEXT_LOSS_AUDIT = join(
  'reports/evaluation/runs',
  'context-loss-forensic-audit-2026-09-21',
  'audit.json',
);
const DIAGNOSTIC_PATH = join(
  'reports/evaluation/runs',
  'retrieval-diagnostic-2026-09-21',
  'diagnostic.json',
);
const ROUTING_RUN_ID = '2026-09-19T22-46-46-088Z';
const LEGACY_CACHE_PATHS = [
  join(
    'reports/evaluation/runs',
    '2026-09-21T16-59-10-310Z',
    'question-embeddings-cache.json',
  ),
  join(
    'reports/evaluation/runs',
    'retrieval-depth-benchmark-2026-09-21',
    'embedding-cache.json',
  ),
];

interface ContextLossRecord {
  questionId: string;
  questionType: string;
  question: string;
  routedCorpusIds: string[];
  goldArticles: Array<{ corpusId: string; articleNumber: string }>;
  goldArticlesMissingFromContext: Array<{ corpusId: string; articleNumber: string }>;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

async function resolveEmbeddingCache(input: {
  cohortIds: string[];
  questionsById: Map<string, { question: string }>;
  openAIService: OpenAIService;
}): Promise<{ cache: QuestionEmbeddingCacheFile; apiEmbeddingCalls: number }> {
  const candidates = [EMBEDDING_CACHE_PATH, ...LEGACY_CACHE_PATHS];
  for (const path of candidates) {
    if (await fileExists(path)) {
      const cache = await loadQuestionEmbeddingCache(path);
      const missing = input.cohortIds.filter((id) => !cache.embeddings[id]);
      if (missing.length === 0) {
        console.log(`Reusing embedding cache: ${path}`);
        if (path !== EMBEDDING_CACHE_PATH) {
          await mkdir(OUTPUT_DIR, { recursive: true });
          await writeFile(
            EMBEDDING_CACHE_PATH,
            `${JSON.stringify(cache, null, 2)}\n`,
          );
        }
        return { cache, apiEmbeddingCalls: 0 };
      }
      console.log(
        `Cache ${path} incomplete (${missing.length} missing), will refresh missing only`,
      );
    }
  }

  let cache: QuestionEmbeddingCacheFile = {
    metadata: {
      embeddingModel: input.openAIService.getEmbeddingModel(),
      dimensions: EMBEDDING_DIMENSIONS,
      source: 'run-retrieval-depth-benchmark-2026-09-22.ts',
    },
    embeddings: {},
  };

  for (const path of candidates) {
    if (await fileExists(path)) {
      cache = await loadQuestionEmbeddingCache(path);
      break;
    }
  }

  let apiEmbeddingCalls = 0;
  for (const questionId of input.cohortIds) {
    if (cache.embeddings[questionId]) {
      continue;
    }
    const question = input.questionsById.get(questionId)?.question;
    if (!question) {
      throw new Error(`Missing question text for ${questionId}`);
    }
    const normalized = validateQuestion(question);
    const result = await input.openAIService.createEmbeddings([normalized]);
    const vector = result[0]?.embedding;
    if (!vector) {
      throw new Error(`Embedding API returned empty for ${questionId}`);
    }
    cache.embeddings[questionId] = vector;
    apiEmbeddingCalls += 1;
    console.log(
      `Embedded ${questionId} (${apiEmbeddingCalls} API calls this run)`,
    );
  }

  cache.metadata = {
    embeddingModel: input.openAIService.getEmbeddingModel(),
    dimensions: EMBEDDING_DIMENSIONS,
    source: 'run-retrieval-depth-benchmark-2026-09-22.ts',
    cohort: 'context-loss A (61)',
    apiEmbeddingCallsLastRun: apiEmbeddingCalls,
  } as QuestionEmbeddingCacheFile['metadata'] & {
    cohort?: string;
    apiEmbeddingCallsLastRun?: number;
  };

  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(EMBEDDING_CACHE_PATH, `${JSON.stringify(cache, null, 2)}\n`);
  return { cache, apiEmbeddingCalls };
}

function buildReport(input: {
  questionCount: number;
  goldArticleCount: number;
  apiEmbeddingCalls: number;
  quotaRows: RetrievalDepthAggregateRow[];
  globalRows: RetrievalDepthAggregateRow[];
  marginalBandsQuota: ReturnType<typeof summarizeMarginalGoldBands>;
  absentAt20Quota: GoldRankDetail[];
  decision: ReturnType<typeof classifyDepthDecision>;
  sameCorpusExamples: Array<{
    questionId: string;
    gold: string;
    neighbors: ReturnType<typeof buildCorpusNeighborWindow>;
    quotaRank50: number | null;
  }>;
}): string {
  const marginalGains = computeMarginalGains(input.quotaRows);

  const lines = [
    '# Benchmark retrieval depth @20/@30/@40/@50',
    '',
    '## 1. Cohorte',
    '',
    `- **${input.questionCount}** questions (context-loss forensic A, diagnostic 2026-09-21)`,
    `- **${input.goldArticleCount}** articles gold (total attendus)`,
    '',
    '## 2. Methode',
    '',
    '- 1 embedding / question (cache persiste dans `embedding-cache.json`)',
    '- Retrieval read-only Postgres pgvector (`embedding <=>`)',
    '- Variante **global**: topK sur union des corpus routes',
    '- Variante **quota**: `computePerCorpusQuota` + merge production (`corpus-quota-retrieval.ts`)',
    `- Profondeurs: ${RETRIEVAL_DEPTH_K_VALUES.join(', ')}`,
    '',
    '## 3. Confirmations',
    '',
    '- Aucun Jina / rerank / filter / generation / judge LLM',
    `- Appels embedding API cette execution: **${input.apiEmbeddingCalls}**`,
    '',
    '## 4. Resultats — variante quota (production multicorpus)',
    '',
    '| Metrique | @20 | @30 | @40 | @50 |',
    '|----------|----:|----:|----:|----:|',
    `| Gold article recall | ${pct(input.quotaRows.find((r) => r.k === 20)!.goldRecall)} | ${pct(input.quotaRows.find((r) => r.k === 30)!.goldRecall)} | ${pct(input.quotaRows.find((r) => r.k === 40)!.goldRecall)} | ${pct(input.quotaRows.find((r) => r.k === 50)!.goldRecall)} |`,
    `| Full gold coverage (questions) | ${input.quotaRows.find((r) => r.k === 20)!.fullQuestionCoverageCount}/${input.questionCount} | ${input.quotaRows.find((r) => r.k === 30)!.fullQuestionCoverageCount}/${input.questionCount} | ${input.quotaRows.find((r) => r.k === 40)!.fullQuestionCoverageCount}/${input.questionCount} | ${input.quotaRows.find((r) => r.k === 50)!.fullQuestionCoverageCount}/${input.questionCount} |`,
    `| Corpus coverage (multi) | ${pct(input.quotaRows.find((r) => r.k === 20)!.goldCorpusCoverageRate)} | ${pct(input.quotaRows.find((r) => r.k === 30)!.goldCorpusCoverageRate)} | ${pct(input.quotaRows.find((r) => r.k === 40)!.goldCorpusCoverageRate)} | ${pct(input.quotaRows.find((r) => r.k === 50)!.goldCorpusCoverageRate)} |`,
    '',
    '## 5. Resultats — variante global',
    '',
    '| Metrique | @20 | @30 | @40 | @50 |',
    '|----------|----:|----:|----:|----:|',
    `| Gold article recall | ${pct(input.globalRows.find((r) => r.k === 20)!.goldRecall)} | ${pct(input.globalRows.find((r) => r.k === 30)!.goldRecall)} | ${pct(input.globalRows.find((r) => r.k === 40)!.goldRecall)} | ${pct(input.globalRows.find((r) => r.k === 50)!.goldRecall)} |`,
    '',
    '## 6. Gains marginaux (quota)',
    '',
    '| Bande | Nouveaux gold |',
    '|-------|-------------:|',
    ...input.marginalBandsQuota.map(
      (row) => `| @${row.band} | ${row.newGoldArticles} |`,
    ),
    '',
    '| Transition recall | Delta |',
    '|-------------------|------:|',
    ...marginalGains.map(
      (row) =>
        `| ${row.fromK} -> ${row.toK} | ${(row.recallDeltaPctPoints >= 0 ? '+' : '')}${row.recallDeltaPctPoints.toFixed(1)} pts |`,
    ),
    '',
    '## 7. Gold absents @20 (quota, cohorte complete)',
    '',
    `- Total articles gold absents @20: **${input.absentAt20Quota.length}**`,
    `- Recuperes 21-30: **${input.decision.recovered21to50}** (dont bandes ci-dessus)`,
    `- Toujours absents @50: **${input.decision.stillAbsentAt50}**`,
    '',
    '## 8. Cas meme corpus (voisins locaux)',
    '',
  ];

  for (const example of input.sameCorpusExamples) {
    lines.push(
      `### ${example.questionId} — gold ${example.gold}`,
      '',
      `Rang gold dans quota @50: ${example.quotaRank50 ?? 'absent'}`,
      '',
      '| rank | article | distance | gold |',
      '|-----:|---------|---------:|:----:|',
    );
    for (const row of example.neighbors) {
      lines.push(
        `| ${row.rank} | ${row.articleNumber} | ${row.distance?.toFixed(4) ?? 'n/a'} | ${row.isGold ? 'yes' : ''} |`,
      );
    }
    lines.push('');
  }

  lines.push(
    '## 9. Conclusion',
    '',
    `**Categorie:** \`${input.decision.category}\``,
    '',
    input.decision.rationale,
    '',
    '## 10. Prochaine experience recommandee',
    '',
    input.decision.category === 'DEPTH_IS_MATERIAL'
      ? '- Smoke cible **retrievalTopK=30** (quota inchange) sur sous-ensemble 61 + persistance top50; pas de prod sans smoke.'
      : input.decision.category === 'SEMANTIC_CEILING'
        ? '- Ne pas augmenter topK; benchmark **query transformation / hybrid lexical+vector** sur 10-15 cas meme-corpus (ex. q352).'
        : '- Separer deux sous-cohortes (recuperables 21-50 vs absents @50) et lancer smoke topK=30 uniquement sur la premiere.',
    '',
  );

  return `${lines.join('\n')}\n`;
}

async function main(): Promise<void> {
  const [contextRaw, diagnosticRaw, routingRaw, datasetQuestions] =
    await Promise.all([
      readFile(CONTEXT_LOSS_AUDIT, 'utf-8'),
      readFile(DIAGNOSTIC_PATH, 'utf-8'),
      readFile(
        join('reports/evaluation/runs', ROUTING_RUN_ID, 'routing.json'),
        'utf-8',
      ),
      loadMulticorpusEvaluationDataset(DEFAULT_MULTICORPUS_EVALUATION_DATASET_PATH),
    ]);

  const contextAudit = JSON.parse(contextRaw) as { records: ContextLossRecord[] };
  const diagnostic = JSON.parse(diagnosticRaw) as {
    diagnostics: Array<{
      questionId: string;
      gold: { corpusId: string; articleNumber: string };
      pipelineStage: string;
      competitor: { pattern: string };
    }>;
  };

  const routingReport = JSON.parse(routingRaw) as {
    results: RoutingQuestionResult[];
  };
  const quotaAudit = JSON.parse(
    await readFile(
      join(
        'reports/evaluation/runs',
        'multicorpus-rerank-filter-audit-quota-2026-09-21T15-22-47-287Z',
        'audit.json',
      ),
      'utf-8',
    ),
  ) as { perQuestion: QuestionQuotaAuditRecord[] };

  const cohort = contextAudit.records.filter(
    (record) => record.questionId !== 'q372',
  );
  if (cohort.length !== 61) {
    throw new Error(`Expected 61 cohort questions, got ${cohort.length}`);
  }

  const routingById = new Map(
    routingReport.results.map((result) => [result.questionId, result]),
  );
  const quotaById = new Map(
    quotaAudit.perQuestion.map((record) => [record.questionId, record]),
  );
  const questionById = new Map(
    datasetQuestions.map((question) => [question.id, question]),
  );

  const app = await NestFactory.createApplicationContext(RetrievalPipelineModule, {
    logger: ['error', 'warn'],
  });

  let apiEmbeddingCalls = 0;
  const perQuestionResults: unknown[] = [];
  const quotaQuestionResults = [];
  const globalQuestionResults = [];
  const goldRankDetailsQuota: GoldRankDetail[] = [];

  try {
    const prisma = app.get(PrismaService);
    const openAIService = app.get(OpenAIService);

    const cohortIds = cohort.map((record) => record.questionId);
    const resolvedCache = await resolveEmbeddingCache({
      cohortIds,
      questionsById: questionById,
      openAIService,
    });
    const cache = resolvedCache.cache;
    apiEmbeddingCalls = resolvedCache.apiEmbeddingCalls;

    for (const record of cohort) {
      const question = questionById.get(record.questionId);
      if (!question) {
        throw new Error(`Missing dataset entry ${record.questionId}`);
      }

      const routedCorpusIds =
        quotaById.get(record.questionId)?.routedCorpusIds ??
        (routingById.get(record.questionId)?.predictedCorpusIds.length
          ? [...routingById.get(record.questionId)!.predictedCorpusIds].sort()
          : [...record.routedCorpusIds].sort());

      const embedding = cache.embeddings[record.questionId];
      if (!embedding) {
        throw new Error(`Missing embedding in cache for ${record.questionId}`);
      }

      const replay = await replayRetrievalDepthForQuestion({
        prisma,
        embedding,
        routedCorpusIds,
      });

      const quotaResult = buildQuestionRetrievalDepthResult({
        questionId: record.questionId,
        questionType: record.questionType,
        routedCorpusIds,
        goldArticles: question.goldArticles,
        strategy: 'quota',
        dataSource: 'local-vector-replay',
        rankedChunks: replay.quotaByK[50],
        observedMaxK: 50,
      });

      const globalResult = buildQuestionRetrievalDepthResult({
        questionId: record.questionId,
        questionType: record.questionType,
        routedCorpusIds,
        goldArticles: question.goldArticles,
        strategy: 'global',
        dataSource: 'local-vector-replay',
        rankedChunks: replay.globalByK[50],
        observedMaxK: 50,
      });

      quotaQuestionResults.push(quotaResult);
      globalQuestionResults.push(globalResult);

      for (const gold of question.goldArticles) {
        goldRankDetailsQuota.push(
          goldRankDetailForStrategy({
            questionId: record.questionId,
            gold,
            strategy: 'quota',
            rankedAt50: replay.quotaByK[50],
          }),
        );
      }

      perQuestionResults.push({
        questionId: record.questionId,
        question: question.question,
        questionType: record.questionType,
        routedCorpusIds,
        goldArticles: question.goldArticles,
        quota: {
          byK: replay.quotaByK,
          metrics: quotaResult.metricsByK,
          goldDepth: quotaResult.goldDepth,
        },
        global: {
          byK: replay.globalByK,
          metrics: globalResult.metricsByK,
          goldDepth: globalResult.goldDepth,
        },
        corpusLocalDeep: Object.fromEntries(replay.perCorpusDeep.entries()),
      });
    }
  } finally {
    await app.close();
  }

  const quotaRows = RETRIEVAL_DEPTH_K_VALUES.map((k) =>
    aggregateRetrievalDepth(quotaQuestionResults, k),
  );
  const globalRows = RETRIEVAL_DEPTH_K_VALUES.map((k) =>
    aggregateRetrievalDepth(globalQuestionResults, k),
  );

  const absentAt20Quota = goldRankDetailsQuota.filter(
    (detail) => detail.absentAt20,
  );
  const marginalBandsQuota = summarizeMarginalGoldBands(
    goldRankDetailsQuota,
    true,
  );

  const decision = classifyDepthDecision({
    absentAt20Details: absentAt20Quota,
    recallAt20: quotaRows.find((row) => row.k === 20)!.goldRecall,
    recallAt50: quotaRows.find((row) => row.k === 50)!.goldRecall,
  });

  const sameCorpusCandidates = diagnostic.diagnostics.filter(
    (entry) =>
      entry.pipelineStage === 'R0' &&
      entry.competitor.pattern === 'A_same_corpus_wrong_article',
  );

  const sameCorpusExamples: Array<{
    questionId: string;
    gold: string;
    neighbors: ReturnType<typeof buildCorpusNeighborWindow>;
    quotaRank50: number | null;
  }> = [];

  for (const candidate of sameCorpusCandidates.slice(0, 8)) {
    const perQ = perQuestionResults.find(
      (entry) =>
        (entry as { questionId: string }).questionId === candidate.questionId,
    ) as
      | {
          corpusLocalDeep: Record<string, Array<{ rank: number; corpusId: string; articleNumber: string; distance?: number }>>;
          quota: { byK: Record<number, Array<{ rank: number; articleNumber: string; corpusId: string }>> };
        }
      | undefined;
    if (!perQ) {
      continue;
    }
    const localList = perQ.corpusLocalDeep[candidate.gold.corpusId] ?? [];
    sameCorpusExamples.push({
      questionId: candidate.questionId,
      gold: `${candidate.gold.corpusId}:${candidate.gold.articleNumber}`,
      neighbors: buildCorpusNeighborWindow({
        questionId: candidate.questionId,
        gold: candidate.gold,
        corpusLocalList: localList,
      }),
      quotaRank50:
        goldRankDetailsQuota.find(
          (detail) =>
            detail.questionId === candidate.questionId &&
            detail.gold.corpusId === candidate.gold.corpusId &&
            detail.gold.articleNumber === candidate.gold.articleNumber,
        )?.rank50 ?? null,
    });
  }

  const goldArticleCount = cohort.reduce(
    (sum, record) =>
      sum + (questionById.get(record.questionId)?.goldArticles.length ?? 0),
    0,
  );

  const benchmarkPayload = {
    metadata: {
      timestamp: new Date().toISOString(),
      cohortSource: CONTEXT_LOSS_AUDIT,
      diagnosticSource: DIAGNOSTIC_PATH,
      embeddingCachePath: EMBEDDING_CACHE_PATH,
      apiEmbeddingCallsThisRun: apiEmbeddingCalls,
      constraints: ['No Jina', 'No LLM generation', 'No E2E 500', 'Read-only SQL'],
    },
    dataset: {
      questionCount: cohort.length,
      goldArticleCount,
      questionIds: cohort.map((record) => record.questionId),
    },
    summary: {
      quota: { rows: quotaRows, marginalBands: marginalBandsQuota, decision },
      global: { rows: globalRows },
      goldRankDetailsQuota,
      absentAt20QuotaCount: absentAt20Quota.length,
    },
    perQuestion: perQuestionResults,
  };

  const report = buildReport({
    questionCount: cohort.length,
    goldArticleCount,
    apiEmbeddingCalls,
    quotaRows,
    globalRows,
    marginalBandsQuota,
    absentAt20Quota,
    decision,
    sameCorpusExamples,
  });

  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(
    join(OUTPUT_DIR, 'benchmark.json'),
    `${JSON.stringify(benchmarkPayload, null, 2)}\n`,
  );
  await writeFile(
    join(OUTPUT_DIR, 'per-question.json'),
    `${JSON.stringify(perQuestionResults, null, 2)}\n`,
  );
  await writeFile(join(OUTPUT_DIR, 'REPORT.md'), report);

  console.log('Retrieval depth benchmark 2026-09-22 complete');
  console.log(`API embedding calls: ${apiEmbeddingCalls}`);
  console.log(`Decision: ${decision.category}`);
  console.log(`Output: ${OUTPUT_DIR}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
