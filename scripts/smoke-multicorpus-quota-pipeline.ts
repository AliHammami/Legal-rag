import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { NestFactory } from '@nestjs/core';

import { DEFAULT_MULTICORPUS_EVALUATION_DATASET_PATH } from '../src/evaluation/constants.js';
import { loadMulticorpusEvaluationDataset } from '../src/evaluation/load-multicorpus-dataset.js';
import {
  DEFAULT_MULTICORPUS_RESULTS_DIR,
  buildDefaultModelConfiguration,
} from '../src/evaluation/multicorpus/evaluation-config.js';
import type { RoutingQuestionResult } from '../src/evaluation/multicorpus/types.js';
import { dynamicContextFilter } from '../src/generation/dynamic-context-filter.js';
import { createPipelineProfiling } from '../src/profiling/pipeline-timings.js';
import { OpenAIService } from '../src/openai/openai.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { JinaRerankerService } from '../src/reranking/jina-reranker.service.js';
import { searchAndRerankQuestion } from '../src/reranking/search-and-rerank-question.js';
import { RerankingPipelineModule } from '../src/reranking/reranking-pipeline.module.js';
import { createJinaEvaluationRerankerService } from '../src/evaluation/multicorpus/jina-concurrency-limit.js';

interface RoutingReportFile {
  results: RoutingQuestionResult[];
}

interface StageCorpusCoverage {
  bothCorporaPresent: number;
  oneCorpusPresent: number;
  zeroCorporaPresent: number;
}

function corpusCoverage(
  chunks: Array<{ corpusId: string }>,
  routedCorpusIds: string[],
): number {
  const represented = new Set(chunks.map((chunk) => chunk.corpusId));
  return routedCorpusIds.filter((corpusId) => represented.has(corpusId)).length;
}

function summarizeCoverage(counts: StageCorpusCoverage, total: number) {
  return {
    bothCorporaPresent: counts.bothCorporaPresent,
    bothCorporaPresentPct: total > 0 ? counts.bothCorporaPresent / total : 0,
    oneCorpusPresent: counts.oneCorpusPresent,
    zeroCorporaPresent: counts.zeroCorporaPresent,
  };
}

async function main(): Promise<void> {
  const routingRun = '2026-09-19T22-46-46-088Z';
  const diagnosticPath = join(
    DEFAULT_MULTICORPUS_RESULTS_DIR,
    '2026-09-19T23-21-51-901Z',
    'e2e-errors-diagnostic.json',
  );
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputDir = join(
    DEFAULT_MULTICORPUS_RESULTS_DIR,
    `multicorpus-quota-smoke-${timestamp}`,
  );

  const [allQuestions, diagnosticRaw, routingRaw] = await Promise.all([
    loadMulticorpusEvaluationDataset(DEFAULT_MULTICORPUS_EVALUATION_DATASET_PATH),
    readFile(diagnosticPath, 'utf-8'),
    readFile(
      join(DEFAULT_MULTICORPUS_RESULTS_DIR, routingRun, 'routing.json'),
      'utf-8',
    ),
  ]);

  const diagnostic = JSON.parse(diagnosticRaw) as {
    generation: Array<{ id: string; type: string }>;
  };
  const routingReport = JSON.parse(routingRaw) as RoutingReportFile;
  const routingById = new Map(
    routingReport.results.map((result) => [result.questionId, result]),
  );

  const errorIds = diagnostic.generation
    .filter((entry) => entry.type === 'multi-corpus')
    .map((entry) => entry.id);
  const questions = allQuestions.filter((question) => errorIds.includes(question.id));

  const modelConfiguration = buildDefaultModelConfiguration();
  const app = await NestFactory.createApplicationContext(RerankingPipelineModule, {
    logger: ['error', 'warn'],
  });

  try {
    const prisma = app.get(PrismaService);
    const openAIService = app.get(OpenAIService);
    const rerankerService = createJinaEvaluationRerankerService(
      app.get(JinaRerankerService),
      { concurrencyLimit: 1 },
    );

    const retrievalCoverage: StageCorpusCoverage = {
      bothCorporaPresent: 0,
      oneCorpusPresent: 0,
      zeroCorporaPresent: 0,
    };
    const rerankCoverage: StageCorpusCoverage = {
      bothCorporaPresent: 0,
      oneCorpusPresent: 0,
      zeroCorporaPresent: 0,
    };
    const filterCoverage: StageCorpusCoverage = {
      bothCorporaPresent: 0,
      oneCorpusPresent: 0,
      zeroCorporaPresent: 0,
    };

    let evaluated = 0;
    let skippedNotTwoCorpus = 0;
    let totalEmbeddingCalls = 0;
    let totalRerankCalls = 0;
    let totalRetrievalMs = 0;
    let totalRerankMs = 0;
    const perQuestion: Array<Record<string, unknown>> = [];

    for (const question of questions) {
      const routing = routingById.get(question.id);
      if (!routing || routing.predictedCorpusIds.length !== 2) {
        skippedNotTwoCorpus += 1;
        continue;
      }

      const routedCorpusIds = [...routing.predictedCorpusIds].sort();
      const profiling = createPipelineProfiling();
      const result = await searchAndRerankQuestion(
        prisma,
        openAIService,
        rerankerService,
        question.question,
        {
          retrievalTopK: modelConfiguration.retrievalTopK,
          rerankTopK: modelConfiguration.rerankTopK,
          profiling,
          enableRouting: true,
          routingResultOverride: {
            corpusIds: routedCorpusIds,
          },
        },
      );
      const filtered = dynamicContextFilter(result.reranked, {
        relativeScoreThreshold: modelConfiguration.relativeScoreThreshold,
      });

      const stages = [
        { name: 'retrieval', chunks: result.candidates, bucket: retrievalCoverage },
        { name: 'rerank', chunks: result.reranked, bucket: rerankCoverage },
        { name: 'filter', chunks: filtered, bucket: filterCoverage },
      ] as const;

      const stageMetrics: Record<string, number> = {};
      for (const stage of stages) {
        const count = corpusCoverage(stage.chunks, routedCorpusIds);
        stageMetrics[stage.name] = count;
        if (count === 2) stage.bucket.bothCorporaPresent += 1;
        else if (count === 1) stage.bucket.oneCorpusPresent += 1;
        else stage.bucket.zeroCorporaPresent += 1;
      }

      evaluated += 1;
      totalEmbeddingCalls += profiling.embeddingCalls;
      totalRerankCalls += profiling.rerankingCalls;
      totalRetrievalMs += profiling.embeddingMs + profiling.vectorSearchMs;
      totalRerankMs += profiling.jinaRerankingMs;

      perQuestion.push({
        questionId: question.id,
        routedCorpusIds,
        candidateCount: result.candidates.length,
        rerankCount: result.reranked.length,
        filterCount: filtered.length,
        corpusCoverage: stageMetrics,
        goldArticles: question.goldArticles,
      });

      console.log(
        `[${evaluated}/${questions.length - skippedNotTwoCorpus}] ${question.id} retrieval=${stageMetrics.retrieval}/2 rerank=${stageMetrics.rerank}/2 filter=${stageMetrics.filter}/2 candidates=${result.candidates.length}`,
      );
    }

    const summary = {
      timestamp,
      routingRun,
      targetQuestionCount: questions.length,
      evaluatedQuestionCount: evaluated,
      skippedNotTwoCorpusRouting: skippedNotTwoCorpus,
      retrieval: summarizeCoverage(retrievalCoverage, evaluated),
      rerank: summarizeCoverage(rerankCoverage, evaluated),
      filter: summarizeCoverage(filterCoverage, evaluated),
      jinaCalls: totalRerankCalls,
      embeddingCalls: totalEmbeddingCalls,
      averageRetrievalMs: evaluated > 0 ? totalRetrievalMs / evaluated : 0,
      averageRerankMs: evaluated > 0 ? totalRerankMs / evaluated : 0,
    };

    await mkdir(outputDir, { recursive: true });
    await writeFile(
      join(outputDir, 'multicorpus-quota-smoke.json'),
      `${JSON.stringify({ summary, perQuestion }, null, 2)}\n`,
      'utf-8',
    );

    console.log('\nMulticorpus quota pipeline smoke');
    console.log(`Evaluated           : ${summary.evaluatedQuestionCount}/${summary.targetQuestionCount}`);
    console.log(`Skipped (!2 corpus) : ${summary.skippedNotTwoCorpusRouting}`);
    console.log(
      `2 corpus @ retrieval : ${(summary.retrieval.bothCorporaPresentPct * 100).toFixed(1)}% (${summary.retrieval.bothCorporaPresent}/${evaluated})`,
    );
    console.log(
      `2 corpus @ rerank    : ${(summary.rerank.bothCorporaPresentPct * 100).toFixed(1)}% (${summary.rerank.bothCorporaPresent}/${evaluated})`,
    );
    console.log(
      `2 corpus @ filter    : ${(summary.filter.bothCorporaPresentPct * 100).toFixed(1)}% (${summary.filter.bothCorporaPresent}/${evaluated})`,
    );
    console.log(`Jina calls           : ${summary.jinaCalls}`);
    console.log(`Embedding calls      : ${summary.embeddingCalls}`);
    console.log(`Avg retrieval ms     : ${summary.averageRetrievalMs.toFixed(0)}`);
    console.log(`Avg rerank ms        : ${summary.averageRerankMs.toFixed(0)}`);
    console.log(`Output               : ${outputDir}/multicorpus-quota-smoke.json`);
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
