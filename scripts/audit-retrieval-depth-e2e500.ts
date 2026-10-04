import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { NestFactory } from '@nestjs/core';

import { DEFAULT_MULTICORPUS_EVALUATION_DATASET_PATH } from '../src/evaluation/constants.js';
import { loadMulticorpusEvaluationDataset } from '../src/evaluation/load-multicorpus-dataset.js';
import type { GenerationForensicRecord } from '../src/evaluation/multicorpus/generation-forensic-audit.js';
import {
  aggregateRetrievalDepth,
  buildQuestionRetrievalDepthResult,
  computeMarginalGains,
  inferPatternsForQuestion,
  RETRIEVAL_DEPTH_K_VALUES,
  summarizeDepthBuckets,
  type RetrievalDepthAggregateRow,
  type RetrievalDepthQuestionResult,
} from '../src/evaluation/multicorpus/retrieval-depth-benchmark.js';
import {
  loadQuestionEmbeddingCache,
  quotaRetrievalFromAuditTop20,
  replayRetrievalListsAt50,
} from '../src/evaluation/multicorpus/retrieval-depth-local-replay.js';
import type { QuestionQuotaAuditRecord } from '../src/evaluation/multicorpus/rerank-filter-quota-audit.js';
import type { RoutingQuestionResult } from '../src/evaluation/multicorpus/types.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { RetrievalPipelineModule } from '../src/retrieval/retrieval-pipeline.module.js';

const E2E_RUN_ID = '2026-09-21T16-59-10-310Z';
const ROUTING_RUN_ID = '2026-09-19T22-46-46-088Z';
const GEN_FORENSIC_DIR = join(
  'reports/evaluation/runs',
  'generation-forensic-audit-2026-09-21',
);
const QUOTA_AUDIT_PATH = join(
  'reports/evaluation/runs',
  'multicorpus-rerank-filter-audit-quota-2026-09-21T15-22-47-287Z',
  'audit.json',
);
const OUTPUT_DIR = join(
  'reports/evaluation/runs',
  'retrieval-depth-benchmark-2026-09-21',
);

interface QuotaAuditFile {
  perQuestion: QuestionQuotaAuditRecord[];
}

interface RoutingReportFile {
  results: RoutingQuestionResult[];
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function pctPoints(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)} pts`;
}

function buildReportMarkdown(input: {
  cohortSize: number;
  singleCount: number;
  multiCount: number;
  benchmarked: {
    quotaArtifact20: number;
    localQuota50: number;
    localGlobal50: number;
  };
  notBenchmarkable: number;
  quotaArtifactRows: RetrievalDepthAggregateRow[];
  localQuotaRows: RetrievalDepthAggregateRow[];
  localGlobalRows: RetrievalDepthAggregateRow[];
  marginalQuota: ReturnType<typeof computeMarginalGains>;
  marginalLocalQuota: ReturnType<typeof computeMarginalGains>;
  depthBucketsArtifact: ReturnType<typeof summarizeDepthBuckets>;
  depthBucketsLocalQuota: ReturnType<typeof summarizeDepthBuckets>;
  examples: RetrievalDepthQuestionResult[];
}): string {
  const canAnswerDepth =
    input.benchmarked.localQuota50 > 0 &&
    input.localQuotaRows.some((row) => row.k === 50);

  const artifact20 = input.quotaArtifactRows.find((row) => row.k === 20);

  const execAnswer = canAnswerDepth
    ? `Sur ${input.benchmarked.localQuota50} questions rejouees en local (SQL, embeddings en cache, sans appel embedding API), voir gains marginaux @20?@50 ci-dessous.`
    : artifact20
      ? `Avec les seuls artefacts top20 (${input.benchmarked.quotaArtifact20} questions), le recall @20 quota est ${pct(artifact20.goldRecall)}. Les profondeurs 21 — 50 ne sont **pas mesurables** sans replay vectoriel local (cache embeddings).`
      : 'Donnees insuffisantes.';

  const lines = [
    '# Benchmark retrieval depth — cohorte A (61 erreurs contexte)',
    '',
    '## 1. Executive summary',
    '',
    execAnswer,
    '',
    canAnswerDepth
      ? `Gain recall ${pctPoints(input.marginalLocalQuota.reduce((sum, row) => sum + row.recallDeltaPctPoints, 0))} cumule 20?50 (quota, local).`
      : '',
    '',
    '## 2. Dataset',
    '',
    `- Cohorte A (contexte insuffisant): **${input.cohortSize}** questions`,
    `- Single-corpus: **${input.singleCount}**`,
    `- Multicorpus: **${input.multiCount}**`,
    `- Benchmarkables quota @20 (artefact): **${input.benchmarked.quotaArtifact20}**`,
    `- Benchmarkables local @50 (cache embeddings + Postgres): **${input.benchmarked.localQuota50}** (quota) / **${input.benchmarked.localGlobal50}** (global)`,
    `- Non benchmarkables (sans top20 ni embedding cache): **${input.notBenchmarkable}**`,
    '',
    'Sources:',
    '- `generation-forensic-audit-2026-09-21` (cohorte)',
    '- `multicorpus-rerank-filter-audit-quota-2026-09-21` (retrieval top20 persiste, strategie quota production)',
    '- Routing `2026-09-19T22-46-46-088Z/routing.json` (corpus routes pour replay local)',
    '- Embeddings: fichier cache optionnel (pas de recalcul API dans ce script)',
    '',
    '## 3. Results — quota @20 (artefact persiste)',
    '',
    '| K | Gold recall | Questions full coverage | Gold absents |',
    '|-:|------------:|------------------------:|-------------:|',
  ];

  for (const row of input.quotaArtifactRows) {
    lines.push(
      `| ${row.k} | ${pct(row.goldRecall)} (${row.goldHits}/${row.goldTotal}) | ${row.fullQuestionCoverageCount}/${row.questionCount} | ${row.goldAbsentCount} |`,
    );
  }

  if (input.localQuotaRows.length > 0) {
    lines.push(
      '',
      '## 3b. Results — quota (local replay @50, derive @20/@30/@40/@50)',
      '',
      '| K | Gold recall | Questions full coverage | Gold absents |',
      '|-:|------------:|------------------------:|-------------:|',
    );
    for (const row of input.localQuotaRows) {
      lines.push(
        `| ${row.k} | ${pct(row.goldRecall)} (${row.goldHits}/${row.goldTotal}) | ${row.fullQuestionCoverageCount}/${row.questionCount} | ${row.goldAbsentCount} |`,
      );
    }

    lines.push(
      '',
      '## 3c. Results — global retrieval (local replay)',
      '',
      '| K | Gold recall | Questions full coverage | Gold absents |',
      '|-:|------------:|------------------------:|-------------:|',
    );
    for (const row of input.localGlobalRows) {
      lines.push(
        `| ${row.k} | ${pct(row.goldRecall)} (${row.goldHits}/${row.goldTotal}) | ${row.fullQuestionCoverageCount}/${row.questionCount} | ${row.goldAbsentCount} |`,
      );
    }
  } else {
    lines.push(
      '',
      '## 3b. Results @30/@40/@50',
      '',
      '**non calculable avec les artefacts du run E2E 500 seul** (pas de listes retrieval >20).',
      '',
      'Pour activer le replay local sans API embedding: placer un cache',
      `\`${join('reports/evaluation/runs', E2E_RUN_ID, 'question-embeddings-cache.json')}\``,
      'puis relancer ce script (1 embedding/question, recherche SQL top50).',
    );
  }

  lines.push('', '## 4. Marginal gains (quota local)', '');
  if (input.marginalLocalQuota.length > 0) {
    for (const row of input.marginalLocalQuota) {
      lines.push(
        `- ${row.fromK} ? ${row.toK}: recall ${pctPoints(row.recallDeltaPctPoints)}, full coverage ${pctPoints(row.fullCoverageDeltaPctPoints)}`,
      );
    }
  } else {
    lines.push('- non calculable (replay local indisponible)');
  }

  lines.push(
    '',
    '## 5. Gold depth (articles gold absents @20)',
    '',
    '### Artefact top20 seulement',
    '',
    '| Categorie | Articles |',
    '|-----------|--------:|',
    `| present @20 | ${input.depthBucketsArtifact.presentAt20} |`,
    `| profondeur 21 — 50 non observee | ${input.depthBucketsArtifact.notObservedBeyond20} |`,
    `| P20-30 | ${input.depthBucketsArtifact.P20_30} |`,
    `| P30-40 | ${input.depthBucketsArtifact.P30_40} |`,
    `| P40-50 | ${input.depthBucketsArtifact.P40_50} |`,
    `| absent @50 | ${input.depthBucketsArtifact.P50_plus} |`,
  );

  if (input.benchmarked.localQuota50 > 0) {
    lines.push(
      '',
      '### Local replay @50 (quota)',
      '',
      '| Categorie | Articles |',
      '|-----------|--------:|',
      `| present @20 | ${input.depthBucketsLocalQuota.presentAt20} |`,
      `| recuperable 21 — 30 | ${input.depthBucketsLocalQuota.P20_30} |`,
      `| recuperable 31 — 40 | ${input.depthBucketsLocalQuota.P30_40} |`,
      `| recuperable 41 — 50 | ${input.depthBucketsLocalQuota.P40_50} |`,
      `| absent @50 | ${input.depthBucketsLocalQuota.P50_plus} |`,
    );
  }

  lines.push('', '## 6. Single vs multicorpus', '');
  lines.push(
    'Voir `benchmark.json` sections `byQuestionType` pour le detail @20 artefact et replay local.',
  );

  lines.push('', '## 7. Exemples representatifs', '');
  for (const example of input.examples) {
    const depthLines = example.goldDepth.map((entry) => {
      const ranks = RETRIEVAL_DEPTH_K_VALUES.map((k) => {
        const rank = entry.ranksByObservedMaxK[k];
        return rank === undefined ? 'n/a' : rank ?? '-';
      }).join(' / ');
      return `- ${entry.gold.corpusId}:${entry.gold.articleNumber} ranks@20/30/40/50=${ranks} bucket=${entry.bucket}`;
    });
    lines.push(
      `### ${example.questionId}`,
      '',
      `**Question:** ${example.questionId} (${example.questionType}, ${example.strategy}, ${example.dataSource})`,
      '',
      '**Gold depth:**',
      ...depthLines,
      '',
    );
  }

  lines.push(
    '## 8. Interpretation',
    '',
    '- Artefact @20: mesure fidele du pipeline quota production sur le sous-ensemble instrumente.',
    '- Sans replay @50, les articles absents @20 ne peuvent pas etre classes entre 21 — 50 et P50+.',
    '- Replay local (cache embeddings + Postgres) distingue profondeur insuffisante vs absence vectorielle.',
    '',
    '## 9. Recommendation',
    '',
    canAnswerDepth
      ? '- Si P20-30/P30-40 dominent: tester retrievalTopK 30/40 en benchmark controle avant production.'
      : '- Generer `question-embeddings-cache.json` (export one-shot) puis relancer ce benchmark pour trancher profondeur vs embedding.',
    '- Persister retrieval top50 dans les prochains runs E2E/diagnostics pour eviter le replay.',
    '',
  );

  return `${lines.filter((line) => line !== undefined).join('\n')}\n`;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const [genForensicRaw, quotaRaw, routingRaw, datasetQuestions] =
    await Promise.all([
      readFile(join(GEN_FORENSIC_DIR, 'audit.json'), 'utf-8'),
      readFile(QUOTA_AUDIT_PATH, 'utf-8'),
      readFile(
        join('reports/evaluation/runs', ROUTING_RUN_ID, 'routing.json'),
        'utf-8',
      ),
      loadMulticorpusEvaluationDataset(DEFAULT_MULTICORPUS_EVALUATION_DATASET_PATH),
    ]);

  const genForensic = JSON.parse(genForensicRaw) as {
    records: GenerationForensicRecord[];
  };
  const quotaAudit = JSON.parse(quotaRaw) as QuotaAuditFile;
  const routingReport = JSON.parse(routingRaw) as RoutingReportFile;

  const cohort = genForensic.records.filter(
    (record) => record.forensicCategory === 'A' && record.questionId !== 'q372',
  );
  if (cohort.length !== 61) {
    throw new Error(`Expected 61 cohort questions, got ${cohort.length}`);
  }

  const quotaById = new Map(
    quotaAudit.perQuestion.map((record) => [record.questionId, record]),
  );
  const routingById = new Map(
    routingReport.results.map((result) => [result.questionId, result]),
  );
  const questionById = new Map(
    datasetQuestions.map((question) => [question.id, question]),
  );

  const artifactQuotaResults: RetrievalDepthQuestionResult[] = [];
  const localQuotaResults: RetrievalDepthQuestionResult[] = [];
  const localGlobalResults: RetrievalDepthQuestionResult[] = [];

  const embeddingCachePath = join(
    'reports/evaluation/runs',
    E2E_RUN_ID,
    'question-embeddings-cache.json',
  );
  const hasEmbeddingCache = await fileExists(embeddingCachePath);

  let prisma: PrismaService | undefined;
  let embeddingCache: Awaited<ReturnType<typeof loadQuestionEmbeddingCache>> | undefined;

  let nestApp: Awaited<
    ReturnType<typeof NestFactory.createApplicationContext>
  > | undefined;

  if (hasEmbeddingCache) {
    embeddingCache = await loadQuestionEmbeddingCache(embeddingCachePath);
    nestApp = await NestFactory.createApplicationContext(
      RetrievalPipelineModule,
      { logger: ['error', 'warn'] },
    );
    prisma = nestApp.get(PrismaService);
  }

  let notBenchmarkable = 0;

  for (const forensic of cohort) {
    const question = questionById.get(forensic.questionId);
    const quotaRecord = quotaById.get(forensic.questionId);
    const routing = routingById.get(forensic.questionId);

    const routedCorpusIds =
      quotaRecord?.routedCorpusIds ??
      (routing?.predictedCorpusIds.length
        ? [...routing.predictedCorpusIds].sort()
        : [...forensic.goldCorpusIds].sort());

    if (quotaRecord?.retrieval?.length) {
      const ranked = quotaRetrievalFromAuditTop20(quotaRecord.retrieval);
      const result = buildQuestionRetrievalDepthResult({
        questionId: forensic.questionId,
        questionType: forensic.questionType,
        routedCorpusIds,
        goldArticles: forensic.goldArticles,
        strategy: 'quota',
        dataSource: 'quota-audit-top20',
        rankedChunks: ranked,
        observedMaxK: 20,
      });
      result.patterns = inferPatternsForQuestion(result, ranked);
      artifactQuotaResults.push(result);
    } else {
      notBenchmarkable += 1;
    }

    if (prisma && embeddingCache?.embeddings[forensic.questionId]) {
      const embedding = embeddingCache.embeddings[forensic.questionId]!;
      const lists = await replayRetrievalListsAt50({
        prisma,
        questionId: forensic.questionId,
        embedding,
        routedCorpusIds,
      });

      const quotaResult = buildQuestionRetrievalDepthResult({
        questionId: forensic.questionId,
        questionType: forensic.questionType,
        routedCorpusIds,
        goldArticles: forensic.goldArticles,
        strategy: 'quota',
        dataSource: 'local-vector-replay',
        rankedChunks: lists.quotaAt50,
        observedMaxK: 50,
      });
      quotaResult.patterns = inferPatternsForQuestion(
        quotaResult,
        lists.quotaAt50,
      );
      localQuotaResults.push(quotaResult);

      const globalResult = buildQuestionRetrievalDepthResult({
        questionId: forensic.questionId,
        questionType: forensic.questionType,
        routedCorpusIds,
        goldArticles: forensic.goldArticles,
        strategy: 'global',
        dataSource: 'local-vector-replay',
        rankedChunks: lists.globalAt50,
        observedMaxK: 50,
      });
      globalResult.patterns = inferPatternsForQuestion(
        globalResult,
        lists.globalAt50,
      );
      localGlobalResults.push(globalResult);
    }
  }

  if (nestApp) {
    await nestApp.close();
  }

  const quotaArtifactRows = RETRIEVAL_DEPTH_K_VALUES.filter((k) => k <= 20).map(
    (k) => aggregateRetrievalDepth(artifactQuotaResults, k),
  );

  const localQuotaRows = RETRIEVAL_DEPTH_K_VALUES.map((k) =>
    aggregateRetrievalDepth(localQuotaResults, k),
  );
  const localGlobalRows = RETRIEVAL_DEPTH_K_VALUES.map((k) =>
    aggregateRetrievalDepth(localGlobalResults, k),
  );

  const marginalLocalQuota =
    localQuotaResults.length > 0 ? computeMarginalGains(localQuotaRows) : [];

  const depthBucketsArtifact = summarizeDepthBuckets(
    artifactQuotaResults.flatMap((result) => result.goldDepth),
  );
  const depthBucketsLocalQuota = summarizeDepthBuckets(
    localQuotaResults.flatMap((result) => result.goldDepth),
  );

  function byType(
    results: RetrievalDepthQuestionResult[],
  ): Record<string, RetrievalDepthAggregateRow> {
    const single = results.filter((r) => r.questionType === 'single-corpus');
    const multi = results.filter((r) => r.questionType !== 'single-corpus');
    return {
      singleCorpusAt20: aggregateRetrievalDepth(single, 20),
      multiCorpusAt20: aggregateRetrievalDepth(multi, 20),
    };
  }

  const perQuestion = [
    ...artifactQuotaResults,
    ...localQuotaResults.map((result) => ({
      ...result,
      companionGlobal: localGlobalResults.find(
        (global) => global.questionId === result.questionId,
      ),
    })),
  ];

  const benchmarkPayload = {
    metadata: {
      timestamp: new Date().toISOString(),
      e2eRunId: E2E_RUN_ID,
      cohort: 'generation-forensic A (61)',
      constraints: [
        'No production changes',
        'No LLM/Jina/rerank/filter/generation',
        'No embedding API in this script (cache file only)',
      ],
      embeddingCacheUsed: hasEmbeddingCache,
      embeddingCachePath: hasEmbeddingCache ? embeddingCachePath : null,
    },
    dataset: {
      total: cohort.length,
      singleCorpus: cohort.filter((q) => q.questionType === 'single-corpus')
        .length,
      multiCorpus: cohort.filter((q) => q.questionType !== 'single-corpus')
        .length,
      benchmarkedQuotaArtifact20: artifactQuotaResults.length,
      benchmarkedLocalQuota50: localQuotaResults.length,
      benchmarkedLocalGlobal50: localGlobalResults.length,
      notBenchmarkable,
    },
    summary: {
      quotaArtifact: {
        rows: quotaArtifactRows,
        depthBuckets: depthBucketsArtifact,
        byQuestionType: byType(artifactQuotaResults),
      },
      localQuota:
        localQuotaResults.length > 0
          ? {
              rows: localQuotaRows,
              marginalGains: marginalLocalQuota,
              depthBuckets: depthBucketsLocalQuota,
              byQuestionType: byType(localQuotaResults),
            }
          : null,
      localGlobal:
        localGlobalResults.length > 0
          ? { rows: localGlobalRows, byQuestionType: byType(localGlobalResults) }
          : null,
    },
    perQuestion,
  };

  const examples = (
    localQuotaResults.length > 0 ? localQuotaResults : artifactQuotaResults
  ).slice(0, 10);

  const reportMarkdown = buildReportMarkdown({
    cohortSize: cohort.length,
    singleCount: benchmarkPayload.dataset.singleCorpus,
    multiCount: benchmarkPayload.dataset.multiCorpus,
    benchmarked: {
      quotaArtifact20: artifactQuotaResults.length,
      localQuota50: localQuotaResults.length,
      localGlobal50: localGlobalResults.length,
    },
    notBenchmarkable,
    quotaArtifactRows,
    localQuotaRows,
    localGlobalRows,
    marginalQuota: [],
    marginalLocalQuota,
    depthBucketsArtifact,
    depthBucketsLocalQuota,
    examples,
  });

  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(
    join(OUTPUT_DIR, 'benchmark.json'),
    `${JSON.stringify(benchmarkPayload, null, 2)}\n`,
  );
  await writeFile(
    join(OUTPUT_DIR, 'per-question.json'),
    `${JSON.stringify(perQuestion, null, 2)}\n`,
  );
  await writeFile(join(OUTPUT_DIR, 'REPORT.md'), reportMarkdown);

  console.log('Retrieval depth benchmark complete');
  console.log(JSON.stringify(benchmarkPayload.dataset, null, 2));
  console.log(`Output: ${OUTPUT_DIR}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
