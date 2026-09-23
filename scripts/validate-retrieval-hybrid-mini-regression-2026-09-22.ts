import { access, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';

import { DEFAULT_MULTICORPUS_EVALUATION_DATASET_PATH } from '../src/evaluation/constants.js';
import { E2EJudgeModule } from '../src/evaluation/e2e-judge.module.js';
import { E2EJudgeService } from '../src/evaluation/e2e-judge.service.js';
import { E2ESourceJudgeModule } from '../src/evaluation/e2e-source-judge.module.js';
import { E2ESourceJudgeService } from '../src/evaluation/e2e-source-judge.service.js';
import { loadMulticorpusEvaluationDataset } from '../src/evaluation/load-multicorpus-dataset.js';
import { buildDefaultModelConfiguration } from '../src/evaluation/multicorpus/evaluation-config.js';
import { buildHybridMiniRegressionCohort } from '../src/evaluation/multicorpus/retrieval-hybrid-mini-regression-cohort.js';
import {
  aggregateMiniRegressionSummary,
  buildMiniRegressionReadme,
  classifyHybridMiniRegressionDecision,
  compareQuestionVariants,
  unionVariantFromArtifacts,
  vectorVariantFromTop30Smoke,
  type MiniRegressionJudgeSnapshot,
  type MiniRegressionQuestionBenchmark,
} from '../src/evaluation/multicorpus/retrieval-hybrid-mini-regression-report.js';
import { rebuildFilteredContextFromSmokeVariant } from '../src/evaluation/multicorpus/retrieval-hybrid-rerank-filter-smoke.js';
import type { RankedRetrievalChunk } from '../src/evaluation/multicorpus/retrieval-depth-benchmark.js';
import type { RetrievalTop30SmokeQuestionResult } from '../src/evaluation/multicorpus/retrieval-top30-smoke-pipeline.js';
import { GenerationPipelineModule } from '../src/generation/generation-pipeline.module.js';
import { RagGenerationService } from '../src/generation/rag-generation.service.js';

const OUTPUT_DIR = join(
  'reports/evaluation/runs',
  'retrieval-hybrid-mini-regression-2026-09-22',
);
const TOP30_SMOKE_CACHE = join(
  'reports/evaluation/runs',
  'retrieval-top30-smoke-2026-09-22',
  'e2e-cache',
);
const HYBRID_RERANK_SMOKE_CACHE = join(
  'reports/evaluation/runs',
  'retrieval-hybrid-rerank-filter-smoke-2026-09-22',
  'cache',
);
const HYBRID_BENCHMARK = join(
  'reports/evaluation/runs',
  'retrieval-hybrid-benchmark-2026-09-22',
  'benchmark.json',
);
const HYBRID_PER_QUESTION = join(
  'reports/evaluation/runs',
  'retrieval-hybrid-benchmark-2026-09-22',
  'per-question.json',
);
const GEN_VALIDATION_CACHE = join(
  'reports/evaluation/runs',
  'retrieval-hybrid-generation-validation-2026-09-22',
  'cache',
);

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    GenerationPipelineModule,
    E2EJudgeModule,
    E2ESourceJudgeModule,
  ],
})
class HybridMiniRegressionModule {}

interface HybridBenchmarkFile {
  listsByQuestion: Record<
    string,
    {
      vectorTop50: RankedRetrievalChunk[];
      unionCandidates: RankedRetrievalChunk[];
    }
  >;
}

interface HybridMetaRow {
  questionId: string;
  questionType: string;
  goldArticles: Array<{ corpusId: string; articleNumber: string }>;
  goldCorpusIds: string[];
  routedCorpusIds: string[];
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

function isExpectedAbstention(questionType: string): boolean {
  return questionType === 'ambiguous' || questionType === 'out-of-scope';
}

function chunkIdsEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  const a = [...left].sort();
  const b = [...right].sort();
  return a.every((id, index) => id === b[index]);
}

async function loadGenValidationUnion(input: {
  questionId: string;
  expectedChunkIds: string[];
}): Promise<{
  answer: string;
  judge: MiniRegressionJudgeSnapshot;
} | null> {
  const path = join(GEN_VALIDATION_CACHE, `${input.questionId}.json`);
  if (!(await fileExists(path))) {
    return null;
  }
  const parsed = JSON.parse(await readFile(path, 'utf-8')) as {
    unionContextChunkIds?: string[];
    union: {
      answer: string;
      judge: {
        correctness: number;
        completeness: number;
        groundedness: number;
        abstentionCorrect: boolean;
      };
      sourceJudge: {
        sourceRelevance: number;
        sourceCoverage: number;
      };
    };
  };
  const unionContextChunkIds = parsed.unionContextChunkIds ?? [];
  if (!chunkIdsEqual(unionContextChunkIds, input.expectedChunkIds)) {
    return null;
  }
  return {
    answer: parsed.union.answer,
    judge: {
      correctness: parsed.union.judge.correctness,
      completeness: parsed.union.judge.completeness,
      groundedness: parsed.union.judge.groundedness,
      sourceRelevance: parsed.union.sourceJudge.sourceRelevance,
      sourceCoverage: parsed.union.sourceJudge.sourceCoverage,
      abstentionCorrect: parsed.union.judge.abstentionCorrect,
    },
  };
}

async function runUnionGenerationJudge(input: {
  questionId: string;
  question: string;
  questionType: string;
  referenceAnswer: string | null;
  routedCorpusIds: string[];
  smokeUnion: import('../src/evaluation/multicorpus/retrieval-hybrid-rerank-filter-smoke.js').HybridRerankFilterVariantResult;
  generationService: RagGenerationService;
  judgeService: E2EJudgeService;
  sourceJudgeService: E2ESourceJudgeService;
}): Promise<{ answer: string; judge: MiniRegressionJudgeSnapshot }> {
  const rebuilt = await rebuildFilteredContextFromSmokeVariant({
    variant: input.smokeUnion,
    routedCorpusIds: input.routedCorpusIds,
  });
  const expectedAbstention = isExpectedAbstention(input.questionType);
  const answer = await input.generationService.generateAnswer({
    question: input.question,
    context: rebuilt.context,
  });
  const judge = await input.judgeService.judgeQuestion({
    questionId: input.questionId,
    question: input.question,
    referenceAnswer: expectedAbstention ? null : input.referenceAnswer,
    generatedAnswer: answer,
    context: rebuilt.context,
    expectedAbstention,
  });
  const sourceJudge = await input.sourceJudgeService.judgeSources({
    questionId: input.questionId,
    question: input.question,
    referenceAnswer: expectedAbstention ? null : input.referenceAnswer,
    generatedAnswer: answer,
    expectedAbstention,
    sources: rebuilt.sources.map((source) => ({
      sourceId: source.sourceId,
      chunkId: source.chunkId,
      articleNumber: source.articleNumber,
      content: source.content,
    })),
    judgeResult: judge,
  });
  return {
    answer,
    judge: {
      correctness: judge.correctness,
      completeness: judge.completeness,
      groundedness: judge.groundedness,
      sourceRelevance: sourceJudge.sourceRelevance,
      sourceCoverage: sourceJudge.sourceCoverage,
      abstentionCorrect: judge.abstentionCorrect,
    },
  };
}

async function main(): Promise<void> {
  const [
    hybridBenchmarkRaw,
    hybridMetaRaw,
    datasetQuestions,
    smokeCacheFiles,
  ] = await Promise.all([
    readFile(HYBRID_BENCHMARK, 'utf-8'),
    readFile(HYBRID_PER_QUESTION, 'utf-8'),
    loadMulticorpusEvaluationDataset(DEFAULT_MULTICORPUS_EVALUATION_DATASET_PATH),
    readdir(HYBRID_RERANK_SMOKE_CACHE),
  ]);

  const hybridBenchmark = JSON.parse(hybridBenchmarkRaw) as HybridBenchmarkFile;
  const hybridMeta = JSON.parse(hybridMetaRaw) as HybridMetaRow[];
  const metaById = new Map(hybridMeta.map((row) => [row.questionId, row]));
  const datasetById = new Map(datasetQuestions.map((q) => [q.id, q]));

  const smokeRecords = [];
  for (const file of smokeCacheFiles.filter((name) => name.endsWith('.json')).sort()) {
    const parsed = JSON.parse(
      await readFile(join(HYBRID_RERANK_SMOKE_CACHE, file), 'utf-8'),
    ) as {
      questionId: string;
      variants: { vector: unknown; union: unknown };
    };
    smokeRecords.push({
      questionId: parsed.questionId,
      variants: {
        vector: parsed.variants.vector,
        union: parsed.variants.union,
      },
    });
  }

  const cohort = buildHybridMiniRegressionCohort({
    smokeRecords: smokeRecords as never,
    metaById: metaById as never,
    maxSize: 30,
  });

  await mkdir(OUTPUT_DIR, { recursive: true });
  await mkdir(join(OUTPUT_DIR, 'cache'), { recursive: true });

  const cachedQuestions = (await fileExists(join(OUTPUT_DIR, 'cache')))
    ? (await readdir(join(OUTPUT_DIR, 'cache'))).filter((f) => f.endsWith('.json'))
        .length
    : 0;
  const remaining = cohort.questionIds.length - cachedQuestions;

  console.log('--- Estimation ---');
  console.log(`questions: ${cohort.questionIds.length}`);
  console.log(`vector: reuse top30-smoke e2e-cache (0 embedding/jina/gen si present)`);
  console.log(`union: reuse hybrid rerank-filter smoke (0 jina) + gen-validation cache si possible`);
  console.log(`generation calls estimes (union seulement): <= ${remaining}`);
  console.log(`judge calls estimes (union seulement): <= ${remaining}`);
  console.log(`source judge calls estimes (union seulement): <= ${remaining}`);
  console.log('embedding calls: 0');
  console.log('Jina calls: 0');
  console.log('routing calls: 0');
  console.log('---');

  const apiCalls = {
    embedding: 0,
    jina: 0,
    routing: 0,
    generation: 0,
    judge: 0,
    sourceJudge: 0,
    openai: 0,
    cacheHits: {
      vectorTop30: 0,
      unionRerankFilter: 0,
      unionGeneration: 0,
    },
    productionModified: 'NO' as const,
  };

  const app = await NestFactory.createApplicationContext(HybridMiniRegressionModule, {
    logger: ['error', 'warn'],
  });

  const results: MiniRegressionQuestionBenchmark[] = [];

  try {
    const generationService = app.get(RagGenerationService);
    const judgeService = app.get(E2EJudgeService);
    const sourceJudgeService = app.get(E2ESourceJudgeService);
    const config = buildDefaultModelConfiguration();

    for (const slot of cohort.slots) {
      const questionId = slot.questionId;
      const resultCachePath = join(OUTPUT_DIR, 'cache', `${questionId}.json`);
      if (await fileExists(resultCachePath)) {
        results.push(
          JSON.parse(await readFile(resultCachePath, 'utf-8')) as MiniRegressionQuestionBenchmark,
        );
        console.log(`Cache ${questionId}`);
        continue;
      }

      const meta = metaById.get(questionId);
      const datasetQuestion = datasetById.get(questionId);
      const lists = hybridBenchmark.listsByQuestion[questionId];
      const rerankSmokePath = join(HYBRID_RERANK_SMOKE_CACHE, `${questionId}.json`);
      const top30Path = join(TOP30_SMOKE_CACHE, `${questionId}.json`);

      if (!meta || !datasetQuestion || !lists || !(await fileExists(rerankSmokePath))) {
        throw new Error(`Missing inputs for ${questionId}`);
      }
      if (!(await fileExists(top30Path))) {
        throw new Error(`Missing top30 smoke cache for ${questionId}`);
      }

      const top30 = JSON.parse(
        await readFile(top30Path, 'utf-8'),
      ) as RetrievalTop30SmokeQuestionResult;
      apiCalls.cacheHits.vectorTop30 += 1;

      const rerankSmoke = JSON.parse(await readFile(rerankSmokePath, 'utf-8')) as {
        variants: { union: import('../src/evaluation/multicorpus/retrieval-hybrid-rerank-filter-smoke.js').HybridRerankFilterVariantResult };
      };
      apiCalls.cacheHits.unionRerankFilter += 1;

      const vector = vectorVariantFromTop30Smoke({ result: top30 });

      let unionGen = await loadGenValidationUnion({
        questionId,
        expectedChunkIds: rerankSmoke.variants.union.finalContextChunkIds,
      });
      if (unionGen) {
        apiCalls.cacheHits.unionGeneration += 1;
      } else {
        unionGen = await runUnionGenerationJudge({
          questionId,
          question: top30.question,
          questionType: datasetQuestion.questionType,
          referenceAnswer: datasetQuestion.referenceAnswer,
          routedCorpusIds: meta.routedCorpusIds,
          smokeUnion: rerankSmoke.variants.union,
          generationService,
          judgeService,
          sourceJudgeService,
        });
        apiCalls.generation += 1;
        apiCalls.judge += 1;
        apiCalls.sourceJudge += 1;
        apiCalls.openai += 3;
      }

      const union = unionVariantFromArtifacts({
        unionCandidates: lists.unionCandidates,
        smokeUnion: rerankSmoke.variants.union,
        goldArticles: meta.goldArticles,
        goldCorpusIds: meta.goldCorpusIds,
        questionType: meta.questionType,
        answer: unionGen.answer,
        judge: unionGen.judge,
      });

      const record: MiniRegressionQuestionBenchmark = {
        questionId,
        question: top30.question,
        questionType: meta.questionType,
        goldArticles: meta.goldArticles,
        routing: top30.routing,
        vector,
        union,
        comparison: compareQuestionVariants({
          vector,
          union,
          goldArticles: meta.goldArticles,
        }),
      };

      results.push(record);
      await writeFile(resultCachePath, `${JSON.stringify(record, null, 2)}\n`);
      console.log(`Done ${questionId} (${results.length}/${cohort.questionIds.length})`);
    }

    const summary = aggregateMiniRegressionSummary(results);
    const decision = classifyHybridMiniRegressionDecision({
      cohortSize: results.length,
      summary,
    });

    const selectionPayload = {
      rulesVersion: cohort.rulesVersion,
      description:
        'Priorite: gold Union > diff contexte > multicorpus > monocorpus > controles meme contexte; remplissage deterministe par questionId.',
      composition: cohort.slots.reduce(
        (acc, slot) => {
          acc[slot.category] = (acc[slot.category] ?? 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      ),
      slots: cohort.slots,
      questionIds: cohort.questionIds,
    };

    const benchmarkPayload = {
      metadata: {
        timestamp: new Date().toISOString(),
        config,
        models: {
          generation: generationService.getGenerationModel(),
          judge: judgeService.getJudgeModel(),
        },
        apiCalls,
        pipelines: {
          vector:
            'routing replay (top30 smoke) -> vector retrieval topK=30 -> Jina -> filter -> generation -> judge',
          union:
            'routing replay -> hybrid Union candidates -> Jina/filter (smoke cache) -> generation -> judge',
        },
      },
      decision,
      perQuestion: results,
    };

    const summaryPayload = {
      ...summary,
      decision,
      improves: results
        .filter((row) => row.comparison.outcome === 'union_improves')
        .map((row) => row.questionId),
      degrades: results
        .filter((row) => row.comparison.outcome === 'union_degrades')
        .map((row) => row.questionId),
      equivalent: results
        .filter((row) => row.comparison.outcome === 'equivalent')
        .map((row) => row.questionId),
    };

    const readme = buildMiniRegressionReadme({
      cohortRules: `${cohort.questionIds.length} questions � voir selection.json`,
      parameters: {
        retrievalTopKVector: 30,
        hybridUnion: 'Vector@50+BM25@50 union (benchmark)',
        rerankTopK: 5,
        relativeScoreThreshold: 0.4,
        minOnePerRoutedCorpus: true,
      },
      decision,
    });

    await writeFile(
      join(OUTPUT_DIR, 'selection.json'),
      `${JSON.stringify(selectionPayload, null, 2)}\n`,
    );
    await writeFile(
      join(OUTPUT_DIR, 'benchmark.json'),
      `${JSON.stringify(benchmarkPayload, null, 2)}\n`,
    );
    await writeFile(
      join(OUTPUT_DIR, 'summary.json'),
      `${JSON.stringify(summaryPayload, null, 2)}\n`,
    );
    await writeFile(join(OUTPUT_DIR, 'README.md'), readme);

    console.log('\n=== Vector vs Union (mini regression) ===');
    console.log(
      `Correctness: ${summary.vector.correctness.toFixed(2)} vs ${summary.union.correctness.toFixed(2)} (? ${summary.delta.correctness.toFixed(2)})`,
    );
    console.log(
      `Completeness: ${summary.vector.completeness.toFixed(2)} vs ${summary.union.completeness.toFixed(2)} (? ${summary.delta.completeness.toFixed(2)})`,
    );
    console.log(
      `Groundedness: ${summary.vector.groundedness.toFixed(2)} vs ${summary.union.groundedness.toFixed(2)} (? ${summary.delta.groundedness.toFixed(2)})`,
    );
    console.log(
      `Final gold recall: ${pct(summary.retrieval.vectorFinalGoldRecall)} vs ${pct(summary.retrieval.unionFinalGoldRecall)}`,
    );
    console.log(
      `Improves / degrades / equivalent: ${summary.comparisonCounts.unionImproves} / ${summary.comparisonCounts.unionDegrades} / ${summary.comparisonCounts.equivalent}`,
    );
    console.log(`Decision: ${decision.category}`);
    console.log(`Production files modified: NO`);
    console.log(`OpenAI calls (this run): ${apiCalls.openai}`);
    console.log(`Generation: ${apiCalls.generation}, Judge: ${apiCalls.judge}, Source judge: ${apiCalls.sourceJudge}`);
    console.log(`Jina: ${apiCalls.jina}, Embeddings: ${apiCalls.embedding}`);
    console.log(`Output: ${OUTPUT_DIR}`);
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
