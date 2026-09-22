import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { NestFactory } from '@nestjs/core';

import { DEFAULT_MULTICORPUS_EVALUATION_DATASET_PATH } from '../src/evaluation/constants.js';
import { loadMulticorpusEvaluationDataset } from '../src/evaluation/load-multicorpus-dataset.js';
import { createJinaEvaluationRerankerService } from '../src/evaluation/multicorpus/jina-concurrency-limit.js';
import type { RankedRetrievalChunk } from '../src/evaluation/multicorpus/retrieval-depth-benchmark.js';
import {
  aggregateHybridVariantMetrics,
  classifyHybridSmokeDecision,
  goldStageFlags,
  runHybridRerankFilterVariant,
  type HybridRerankFilterVariantResult,
} from '../src/evaluation/multicorpus/retrieval-hybrid-rerank-filter-smoke.js';
import type { GoldArticle } from '../src/evaluation/gold-article.js';
import { JinaRerankerService } from '../src/reranking/jina-reranker.service.js';
import { RerankingPipelineModule } from '../src/reranking/reranking-pipeline.module.js';

const HYBRID_DIR = join(
  'reports/evaluation/runs',
  'retrieval-hybrid-benchmark-2026-09-22',
);
const DEPTH_PER_QUESTION = join(
  'reports/evaluation/runs',
  'retrieval-depth-benchmark-2026-09-22',
  'per-question.json',
);
const SEMANTIC_DIAG = join(
  'reports/evaluation/runs',
  'retrieval-semantic-diagnostic-2026-09-22',
  'diagnostic.json',
);
const OUTPUT_DIR = join(
  'reports/evaluation/runs',
  'retrieval-hybrid-rerank-filter-smoke-2026-09-22',
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

function buildReport(input: {
  summary: Record<string, ReturnType<typeof aggregateHybridVariantMetrics>>;
  lossFunnel: {
    union: { gainedRetrieval: number; lostJina: number; lostFilter: number; keptFilter: number };
    rrf: { gainedRetrieval: number; lostJina: number; lostFilter: number; keptFilter: number };
  };
  bm25Only: { atUnionRetrieval: number; surviveUnionFilter: number };
  decision: ReturnType<typeof classifyHybridSmokeDecision>;
  apiCalls: Record<string, number | string>;
  absent29Sample: Array<Record<string, unknown>>;
}): string {
  const row = (key: 'vector' | 'union' | 'rrf') => {
    const metrics = input.summary[key]!;
    return `| ${key.toUpperCase()} | ${pct(metrics.avgRetrievalRecall)} | ${pct(metrics.avgJinaRecall)} | ${pct(metrics.avgFilterRecall)} | ${pct(metrics.fullCoverageRate)} | ${pct(metrics.corpusCoverageRate)} | ${metrics.avgFilterChunks.toFixed(2)} |`;
  };

  return `# Smoke hybrid rerank + filter

## Validation

- OpenAI calls: ${input.apiCalls.openai}
- Embedding calls: ${input.apiCalls.embedding}
- LLM calls: ${input.apiCalls.llm}
- Generation calls: ${input.apiCalls.generation}
- Judge calls: ${input.apiCalls.judge}
- Jina calls: ${input.apiCalls.jina}
- Production files modified: ${input.apiCalls.productionModified}

## Tableau principal

| Variante | Retrieval gold recall | Apres Jina | Apres filter | Full coverage | Corpus coverage | Chunks filter (moy.) |
| -------- | --------------------: | ---------: | -----------: | ------------: | --------------: | -------------------: |
${row('vector')}
${row('union')}
${row('rrf')}

## Pertes Union (gold vs vector)

- Golds gagnes au retrieval (Union vs Vector): **${input.lossFunnel.union.gainedRetrieval}**
- Perdus au Jina: **${input.lossFunnel.union.lostJina}**
- Perdus au filter (apres Jina): **${input.lossFunnel.union.lostFilter}**
- Conserves dans le contexte final: **${input.lossFunnel.union.keptFilter}**

## Pertes RRF (gold vs vector)

- Golds gagnes au retrieval: **${input.lossFunnel.rrf.gainedRetrieval}**
- Perdus au Jina: **${input.lossFunnel.rrf.lostJina}**
- Perdus au filter: **${input.lossFunnel.rrf.lostFilter}**
- Conserves apres filter: **${input.lossFunnel.rrf.keptFilter}**

## BM25-only (Union retrieval)

- Gold articles BM25-only presents en Union retrieval: **${input.bm25Only.atUnionRetrieval}**
- Survivent apres filter Union: **${input.bm25Only.surviveUnionFilter}**

## Echantillon 29 golds vector-absents @50

${input.absent29Sample
  .slice(0, 12)
  .map(
    (row) =>
      `- ${row.questionId} ${row.gold}: vector=${row.vectorRet} bm25=${row.bm25Ret} union=${row.unionRet} | Union jina=${row.unionJina} filter=${row.unionFilter} | RRF jina=${row.rrfJina} filter=${row.rrfFilter}`,
  )
  .join('\n')}

## Decision

**${input.decision.category}**

${input.decision.rationale}
`;
}

async function main(): Promise<void> {
  const [hybridRaw, depthRaw, semanticRaw, datasetQuestions] =
    await Promise.all([
      readFile(join(HYBRID_DIR, 'benchmark.json'), 'utf-8'),
      readFile(DEPTH_PER_QUESTION, 'utf-8'),
      readFile(SEMANTIC_DIAG, 'utf-8'),
      loadMulticorpusEvaluationDataset(DEFAULT_MULTICORPUS_EVALUATION_DATASET_PATH),
    ]);

  const hybrid = JSON.parse(hybridRaw) as {
    metadata: { cohortQuestionIds: string[] };
    listsByQuestion: Record<
      string,
      {
        vectorTop50: RankedRetrievalChunk[];
        bm25Top50: RankedRetrievalChunk[];
        unionCandidates: RankedRetrievalChunk[];
        rrfTop50: RankedRetrievalChunk[];
      }
    >;
  };
  const hybridPerQuestion = JSON.parse(
    await readFile(join(HYBRID_DIR, 'per-question.json'), 'utf-8'),
  ) as Array<{
    questionId: string;
    questionType: string;
    goldArticles: GoldArticle[];
    goldCorpusIds: string[];
    routedCorpusIds: string[];
    goldArticlesBm25Only: GoldArticle[];
  }>;
  const depthRecords = JSON.parse(depthRaw) as Array<{
    questionId: string;
    question: string;
  }>;
  const semantic = JSON.parse(semanticRaw) as {
    cases: Array<{ questionId: string; goldArticle: GoldArticle }>;
  };

  const questionById = new Map(
    depthRecords.map((record) => [record.questionId, record.question]),
  );
  const hybridMetaById = new Map(
    hybridPerQuestion.map((record) => [record.questionId, record]),
  );
  const datasetById = new Map(datasetQuestions.map((q) => [q.id, q]));

  await mkdir(join(OUTPUT_DIR, 'cache'), { recursive: true });

  const app = await NestFactory.createApplicationContext(RerankingPipelineModule, {
    logger: ['error', 'warn'],
  });

  let jinaCalls = 0;
  const perQuestionResults: Array<{
    questionId: string;
    question: string;
    variants: Record<'vector' | 'union' | 'rrf', HybridRerankFilterVariantResult>;
  }> = [];

  try {
    const rerankerService = createJinaEvaluationRerankerService(
      app.get(JinaRerankerService),
      { concurrencyLimit: 1 },
    );

    for (const questionId of hybrid.metadata.cohortQuestionIds) {
      const cachePath = join(OUTPUT_DIR, 'cache', `${questionId}.json`);
      if (await fileExists(cachePath)) {
        perQuestionResults.push(
          JSON.parse(await readFile(cachePath, 'utf-8')) as (typeof perQuestionResults)[0],
        );
        jinaCalls += 3;
        console.log(`Cache ${questionId}`);
        continue;
      }

      const lists = hybrid.listsByQuestion[questionId];
      const meta = hybridMetaById.get(questionId);
      if (!lists || !meta) {
        throw new Error(`Missing hybrid data for ${questionId}`);
      }
      const question =
        questionById.get(questionId) ??
        datasetById.get(questionId)?.question ??
        '';
      if (!question) {
        throw new Error(`Missing question text for ${questionId}`);
      }

      const base = {
        question,
        questionType: meta.questionType,
        goldArticles: meta.goldArticles,
        goldCorpusIds: meta.goldCorpusIds,
        routedCorpusIds: meta.routedCorpusIds,
        rerankerService,
      };

      const vector = await runHybridRerankFilterVariant({
        ...base,
        variant: 'vector',
        candidates: lists.vectorTop50,
      });
      jinaCalls += 1;

      const union = await runHybridRerankFilterVariant({
        ...base,
        variant: 'union',
        candidates: lists.unionCandidates,
      });
      jinaCalls += 1;

      const rrf = await runHybridRerankFilterVariant({
        ...base,
        variant: 'rrf',
        candidates: lists.rrfTop50,
      });
      jinaCalls += 1;

      const record = {
        questionId,
        question,
        variants: { vector, union, rrf },
      };
      perQuestionResults.push(record);
      await writeFile(cachePath, `${JSON.stringify(record, null, 2)}\n`);
      console.log(`Done ${questionId} (${perQuestionResults.length}/61)`);
    }
  } finally {
    await app.close();
  }

  const vectorVariants = perQuestionResults.map((result) => result.variants.vector);
  const unionVariants = perQuestionResults.map((result) => result.variants.union);
  const rrfVariants = perQuestionResults.map((result) => result.variants.rrf);

  const summary = {
    vector: aggregateHybridVariantMetrics(vectorVariants),
    union: aggregateHybridVariantMetrics(unionVariants),
    rrf: aggregateHybridVariantMetrics(rrfVariants),
  };

  let gainedUnionRetrieval = 0;
  let lostUnionJina = 0;
  let lostUnionFilter = 0;
  let keptUnionFilter = 0;
  let gainedRrfRetrieval = 0;
  let lostRrfJina = 0;
  let lostRrfFilter = 0;
  let keptRrfFilter = 0;
  let bm25OnlyAtUnion = 0;
  let bm25OnlySurviveFilter = 0;

  for (const result of perQuestionResults) {
    const meta = hybridMetaById.get(result.questionId)!;
    for (const gold of meta.goldArticles) {
      const v = goldStageFlags(gold, {
        retrieval: hybrid.listsByQuestion[result.questionId]!.vectorTop50,
        jina: result.variants.vector.jinaTop5,
        filter: result.variants.vector.filterRows.filter((row) => row.kept),
      });
      const uRet = goldStageFlags(gold, {
        retrieval: hybrid.listsByQuestion[result.questionId]!.unionCandidates,
        jina: result.variants.union.jinaTop5,
        filter: result.variants.union.filterRows.filter((row) => row.kept),
      });
      const rRet = goldStageFlags(gold, {
        retrieval: hybrid.listsByQuestion[result.questionId]!.rrfTop50,
        jina: result.variants.rrf.jinaTop5,
        filter: result.variants.rrf.filterRows.filter((row) => row.kept),
      });

      if (uRet.inRetrieval && !v.inRetrieval) {
        gainedUnionRetrieval += 1;
      }
      if (uRet.inRetrieval && !uRet.inJina) {
        lostUnionJina += 1;
      }
      if (uRet.inJina && !uRet.inFilter) {
        lostUnionFilter += 1;
      }
      if (uRet.inFilter && uRet.inRetrieval && !v.inRetrieval) {
        keptUnionFilter += 1;
      }

      if (rRet.inRetrieval && !v.inRetrieval) {
        gainedRrfRetrieval += 1;
      }
      if (rRet.inRetrieval && !rRet.inJina) {
        lostRrfJina += 1;
      }
      if (rRet.inJina && !rRet.inFilter) {
        lostRrfFilter += 1;
      }
      if (rRet.inFilter && rRet.inRetrieval && !v.inRetrieval) {
        keptRrfFilter += 1;
      }
    }

    for (const gold of meta.goldArticlesBm25Only) {
      bm25OnlyAtUnion += 1;
      const inFilter = result.variants.union.filterRows.some(
        (row) => row.kept && row.corpusId === gold.corpusId && row.articleNumber === gold.articleNumber,
      );
      if (inFilter) {
        bm25OnlySurviveFilter += 1;
      }
    }
  }

  const absent29Sample = semantic.cases.map((item) => {
    const result = perQuestionResults.find((row) => row.questionId === item.questionId);
    const lists = hybrid.listsByQuestion[item.questionId]!;
    const gold = item.goldArticle;
    const vectorRet = goldStageFlags(gold, {
      retrieval: lists.vectorTop50,
      jina: [],
      filter: [],
    }).inRetrieval;
    const bm25Ret = lists.bm25Top50.some((chunk) =>
      chunk.corpusId === gold.corpusId && chunk.articleNumber === gold.articleNumber,
    );
    const unionRet = lists.unionCandidates.some((chunk) =>
      chunk.corpusId === gold.corpusId && chunk.articleNumber === gold.articleNumber,
    );
    const rrfRet = lists.rrfTop50.some((chunk) =>
      chunk.corpusId === gold.corpusId && chunk.articleNumber === gold.articleNumber,
    );
    const unionJina = result
      ? goldStageFlags(gold, {
          retrieval: lists.unionCandidates,
          jina: result.variants.union.jinaTop5,
          filter: [],
        }).inJina
      : false;
    const unionFilter = result
      ? goldStageFlags(gold, {
          retrieval: lists.unionCandidates,
          jina: result.variants.union.jinaTop5,
          filter: result.variants.union.filterRows.filter((row) => row.kept),
        }).inFilter
      : false;
    const rrfJina = result
      ? goldStageFlags(gold, {
          retrieval: lists.rrfTop50,
          jina: result.variants.rrf.jinaTop5,
          filter: [],
        }).inJina
      : false;
    const rrfFilter = result
      ? goldStageFlags(gold, {
          retrieval: lists.rrfTop50,
          jina: result.variants.rrf.jinaTop5,
          filter: result.variants.rrf.filterRows.filter((row) => row.kept),
        }).inFilter
      : false;

    return {
      questionId: item.questionId,
      gold: `${gold.corpusId}:${gold.articleNumber}`,
      vectorRet,
      bm25Ret,
      unionRet,
      rrfRet,
      unionJina,
      unionFilter,
      rrfJina,
      rrfFilter,
    };
  });

  const decision = classifyHybridSmokeDecision({
    vectorFilterRecall: summary.vector.avgFilterRecall,
    unionFilterRecall: summary.union.avgFilterRecall,
    rrfFilterRecall: summary.rrf.avgFilterRecall,
    vectorRetrievalRecall: summary.vector.avgRetrievalRecall,
    unionRetrievalRecall: summary.union.avgRetrievalRecall,
    bm25OnlySurviveFilter: bm25OnlySurviveFilter,
    bm25OnlyAtUnionRetrieval: bm25OnlyAtUnion,
  });

  const payload = {
    metadata: {
      timestamp: new Date().toISOString(),
      sources: [join(HYBRID_DIR, 'benchmark.json'), join(HYBRID_DIR, 'per-question.json')],
      apiCalls: {
        openai: 0,
        embedding: 0,
        llm: 0,
        generation: 0,
        judge: 0,
        jina: jinaCalls,
        productionModified: 'NO',
      },
    },
    summary,
    lossFunnel: {
      union: {
        gainedRetrieval: gainedUnionRetrieval,
        lostJina: lostUnionJina,
        lostFilter: lostUnionFilter,
        keptFilter: keptUnionFilter,
      },
      rrf: {
        gainedRetrieval: gainedRrfRetrieval,
        lostJina: lostRrfJina,
        lostFilter: lostRrfFilter,
        keptFilter: keptRrfFilter,
      },
    },
    bm25Only: {
      atUnionRetrieval: bm25OnlyAtUnion,
      surviveUnionFilter: bm25OnlySurviveFilter,
    },
    absent29: absent29Sample,
    decision,
    perQuestion: perQuestionResults,
  };

  const report = buildReport({
    summary,
    lossFunnel: payload.lossFunnel,
    bm25Only: payload.bm25Only,
    decision,
    apiCalls: payload.metadata.apiCalls,
    absent29Sample,
  });

  await writeFile(join(OUTPUT_DIR, 'smoke.json'), `${JSON.stringify(payload, null, 2)}\n`);
  await writeFile(
    join(OUTPUT_DIR, 'per-question.json'),
    `${JSON.stringify(perQuestionResults, null, 2)}\n`,
  );
  await writeFile(join(OUTPUT_DIR, 'REPORT.md'), report);

  console.log(`Decision: ${decision.category}`);
  console.log(`Jina calls: ${jinaCalls}`);
  console.log(`Union filter recall: ${pct(summary.union.avgFilterRecall)}`);
  console.log(`Output: ${OUTPUT_DIR}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
