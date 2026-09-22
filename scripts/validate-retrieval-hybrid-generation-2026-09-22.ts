import { access, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';

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
import {
  averageJudgeMetrics,
  classifyGoldAddedImpact,
  classifyHybridGenerationDecision,
  formatGoldList,
  selectHybridGenerationValidationCohort,
  type HybridGenerationCohortEntry,
  type JudgeMetricSnapshot,
  type SmokeQuestionCacheRecord,
} from '../src/evaluation/multicorpus/retrieval-hybrid-generation-validation.js';
import {
  rebuildFilteredContextFromSmokeVariant,
  type HybridRerankFilterVariantResult,
} from '../src/evaluation/multicorpus/retrieval-hybrid-rerank-filter-smoke.js';
import type {
  HybridBenchmarkQuestionMeta,
} from '../src/evaluation/multicorpus/retrieval-hybrid-generation-validation.js';
import { GenerationPipelineModule } from '../src/generation/generation-pipeline.module.js';
import { RagGenerationService } from '../src/generation/rag-generation.service.js';

const SMOKE_DIR = join(
  'reports/evaluation/runs',
  'retrieval-hybrid-rerank-filter-smoke-2026-09-22',
);
const HYBRID_PER_QUESTION = join(
  'reports/evaluation/runs',
  'retrieval-hybrid-benchmark-2026-09-22',
  'per-question.json',
);
const OUTPUT_DIR = join(
  'reports/evaluation/runs',
  'retrieval-hybrid-generation-validation-2026-09-22',
);

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    GenerationPipelineModule,
    E2EJudgeModule,
    E2ESourceJudgeModule,
  ],
})
class HybridGenerationValidationModule {}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function pct(value: number): string {
  return value.toFixed(2);
}

function delta(value: number, base: number): string {
  const diff = value - base;
  const sign = diff > 0 ? '+' : '';
  return `${sign}${diff.toFixed(2)}`;
}

function isExpectedAbstention(questionType: string): boolean {
  return questionType === 'ambiguous' || questionType === 'out-of-scope';
}

interface VariantRunOutput {
  contextChunkIds: string[];
  contextPreview: string;
  answer: string;
  judge: {
    correctness: number;
    completeness: number;
    groundedness: number;
    abstentionCorrect: boolean;
    explanation: string;
  };
  sourceJudge: {
    sourceRelevance: number;
    sourceCoverage: number;
    explanation: string;
  };
  metrics: JudgeMetricSnapshot;
}

async function runVariantArm(input: {
  questionId: string;
  question: string;
  questionType: string;
  referenceAnswer: string | null;
  variant: HybridRerankFilterVariantResult;
  routedCorpusIds: string[];
  generationService: RagGenerationService;
  judgeService: E2EJudgeService;
  sourceJudgeService: E2ESourceJudgeService;
}): Promise<VariantRunOutput> {
  const rebuilt = await rebuildFilteredContextFromSmokeVariant({
    variant: input.variant,
    routedCorpusIds: input.routedCorpusIds,
  });

  const expectedAbstention = isExpectedAbstention(input.questionType);
  const generationStart = performance.now();
  const answer = await input.generationService.generateAnswer({
    question: input.question,
    context: rebuilt.context,
  });
  const generationMs = performance.now() - generationStart;

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

  void generationMs;

  const metrics: JudgeMetricSnapshot = {
    correctness: judge.correctness,
    completeness: judge.completeness,
    groundedness: judge.groundedness,
    sourceRelevance: sourceJudge.sourceRelevance,
    sourceCoverage: sourceJudge.sourceCoverage,
  };

  return {
    contextChunkIds: rebuilt.chunks.map((chunk) => chunk.chunkId),
    contextPreview: rebuilt.context.slice(0, 400),
    answer,
    judge: {
      correctness: judge.correctness,
      completeness: judge.completeness,
      groundedness: judge.groundedness,
      abstentionCorrect: judge.abstentionCorrect,
      explanation: judge.explanation,
    },
    sourceJudge: {
      sourceRelevance: sourceJudge.sourceRelevance,
      sourceCoverage: sourceJudge.sourceCoverage,
      explanation: sourceJudge.explanation,
    },
    metrics,
  };
}

function buildReport(input: {
  cohort: HybridGenerationCohortEntry[];
  vectorAvg: JudgeMetricSnapshot;
  unionAvg: JudgeMetricSnapshot;
  decision: ReturnType<typeof classifyHybridGenerationDecision>;
  goldAddedAnalysis: Array<Record<string, unknown>>;
  apiCalls: Record<string, number | string>;
  models: Record<string, string>;
}): string {
  const row = (label: keyof JudgeMetricSnapshot) =>
    `| ${label} | ${pct(input.vectorAvg[label])} | ${pct(input.unionAvg[label])} | ${delta(input.unionAvg[label], input.vectorAvg[label])} |`;

  return `# Validation generation + judge ÿ hybrid Union vs Vector

## Validation

- OpenAI calls (generation + judge): ${input.apiCalls.openai}
- Embedding calls: ${input.apiCalls.embedding}
- LLM calls (routing): ${input.apiCalls.llm}
- Generation calls: ${input.apiCalls.generation}
- Judge calls: ${input.apiCalls.judge}
- Source judge calls: ${input.apiCalls.sourceJudge}
- Jina calls: ${input.apiCalls.jina}
- Production files modified: ${input.apiCalls.productionModified}

Modeles: generation \`${input.models.generation}\`, judge \`${input.models.judge}\`.

## Cohorte

${input.cohort.length} questions (contexte final Vector != Union), priorite gold Union > BM25-only > diff contexte seul.

## Tableau principal

| Metric | Vector | Union | ? |
| ------ | -----: | ----: | -: |
${row('correctness')}
${row('completeness')}
${row('groundedness')}
${row('sourceRelevance')}
${row('sourceCoverage')}

## Questions avec gold ajoute par Union

${input.goldAddedAnalysis
  .map(
    (row) =>
      `- **${row.questionId}** gold=${JSON.stringify(row.goldAddedByUnion)} impact=${row.impact}`,
  )
  .join('\n')}

## Decision

**${input.decision.category}**

${input.decision.rationale}

${input.decision.recommendation}
`;
}

async function loadSmokeCacheRecords(): Promise<SmokeQuestionCacheRecord[]> {
  const cacheDir = join(SMOKE_DIR, 'cache');
  const files = (await readdir(cacheDir)).filter((name) => name.endsWith('.json'));
  const records: SmokeQuestionCacheRecord[] = [];
  for (const file of files.sort()) {
    const parsed = JSON.parse(
      await readFile(join(cacheDir, file), 'utf-8'),
    ) as SmokeQuestionCacheRecord & {
      variants: SmokeQuestionCacheRecord['variants'] & { rrf?: unknown };
    };
    records.push({
      questionId: parsed.questionId,
      variants: {
        vector: parsed.variants.vector,
        union: parsed.variants.union,
      },
    });
  }
  return records;
}

async function main(): Promise<void> {
  const [hybridMetaRaw, datasetQuestions, smokeRecords] = await Promise.all([
    readFile(HYBRID_PER_QUESTION, 'utf-8'),
    loadMulticorpusEvaluationDataset(DEFAULT_MULTICORPUS_EVALUATION_DATASET_PATH),
    loadSmokeCacheRecords(),
  ]);

  const hybridMeta = JSON.parse(hybridMetaRaw) as HybridBenchmarkQuestionMeta[];
  const metaById = new Map(hybridMeta.map((row) => [row.questionId, row]));
  const datasetById = new Map(datasetQuestions.map((q) => [q.id, q]));

  const { entries: cohort, skippedSameContext } =
    selectHybridGenerationValidationCohort(smokeRecords, metaById, {
      maxSize: 20,
    });

  const cachedCount = (await fileExists(join(OUTPUT_DIR, 'cache')))
    ? (await readdir(join(OUTPUT_DIR, 'cache'))).filter((f) => f.endsWith('.json'))
        .length
    : 0;
  const remaining = cohort.length - cachedCount;

  console.log('--- Estimation avant lancement ---');
  console.log(`questions: ${cohort.length} (${skippedSameContext} exclues: contexte identique)`);
  console.log(`generation calls: ${remaining * 2} (max ${cohort.length * 2})`);
  console.log(`judge calls: ${remaining * 2} (max ${cohort.length * 2})`);
  console.log(`source judge calls: ${remaining * 2} (max ${cohort.length * 2})`);
  console.log('Jina calls: 0');
  console.log('embedding calls: 0');
  console.log('routing calls: 0');
  console.log('---');

  if (cohort.length === 0) {
    throw new Error('No cohort questions with differing Vector/Union context');
  }

  await mkdir(join(OUTPUT_DIR, 'cache'), { recursive: true });

  const app = await NestFactory.createApplicationContext(
    HybridGenerationValidationModule,
    { logger: ['error', 'warn'] },
  );

  const apiCalls = {
    openai: 0,
    embedding: 0,
    llm: 0,
    generation: 0,
    judge: 0,
    sourceJudge: 0,
    jina: 0,
    productionModified: 'NO' as const,
  };

  const perQuestionResults: Array<Record<string, unknown>> = [];

  try {
    const generationService = app.get(RagGenerationService);
    const judgeService = app.get(E2EJudgeService);
    const sourceJudgeService = app.get(E2ESourceJudgeService);
    const models = {
      generation: generationService.getGenerationModel(),
      judge: judgeService.getJudgeModel(),
    };
    const config = buildDefaultModelConfiguration();

    for (const entry of cohort) {
      const cachePath = join(OUTPUT_DIR, 'cache', `${entry.questionId}.json`);
      if (await fileExists(cachePath)) {
        perQuestionResults.push(
          JSON.parse(await readFile(cachePath, 'utf-8')) as Record<string, unknown>,
        );
        console.log(`Cache ${entry.questionId}`);
        continue;
      }

      const meta = metaById.get(entry.questionId);
      const datasetQuestion = datasetById.get(entry.questionId);
      if (!meta || !datasetQuestion) {
        throw new Error(`Missing dataset/meta for ${entry.questionId}`);
      }

      const smokeRecord = smokeRecords.find(
        (record) => record.questionId === entry.questionId,
      );
      if (!smokeRecord) {
        throw new Error(`Missing smoke cache for ${entry.questionId}`);
      }

      const question =
        datasetQuestion.question ||
        (JSON.parse(
          await readFile(join(SMOKE_DIR, 'cache', `${entry.questionId}.json`), 'utf-8'),
        ) as { question: string }).question;

      const vector = await runVariantArm({
        questionId: entry.questionId,
        question,
        questionType: datasetQuestion.questionType,
        referenceAnswer: datasetQuestion.referenceAnswer,
        variant: smokeRecord.variants.vector,
        routedCorpusIds: meta.routedCorpusIds ?? [],
        generationService,
        judgeService,
        sourceJudgeService,
      });
      apiCalls.generation += 1;
      apiCalls.judge += 1;
      apiCalls.sourceJudge += 1;
      apiCalls.openai += 3;

      const union = await runVariantArm({
        questionId: entry.questionId,
        question,
        questionType: datasetQuestion.questionType,
        referenceAnswer: datasetQuestion.referenceAnswer,
        variant: smokeRecord.variants.union,
        routedCorpusIds: meta.routedCorpusIds ?? [],
        generationService,
        judgeService,
        sourceJudgeService,
      });
      apiCalls.generation += 1;
      apiCalls.judge += 1;
      apiCalls.sourceJudge += 1;
      apiCalls.openai += 3;

      const impact = classifyGoldAddedImpact({
        vector: vector.metrics,
        union: union.metrics,
        goldAddedByUnion: entry.goldAddedByUnion,
      });

      const record = {
        questionId: entry.questionId,
        tier: entry.tier,
        goldAddedByUnion: formatGoldList(entry.goldAddedByUnion),
        vectorContextChunkIds: vector.contextChunkIds,
        unionContextChunkIds: union.contextChunkIds,
        vector: {
          contextPreview: vector.contextPreview,
          answer: vector.answer,
          judge: vector.judge,
          sourceJudge: vector.sourceJudge,
          metrics: vector.metrics,
        },
        union: {
          contextPreview: union.contextPreview,
          answer: union.answer,
          judge: union.judge,
          sourceJudge: union.sourceJudge,
          metrics: union.metrics,
        },
        goldAddedImpact: impact,
      };

      perQuestionResults.push(record);
      await writeFile(cachePath, `${JSON.stringify(record, null, 2)}\n`);
      console.log(`Done ${entry.questionId} (${perQuestionResults.length}/${cohort.length})`);
    }

    const vectorMetrics = perQuestionResults.map(
      (row) => (row.vector as { metrics: JudgeMetricSnapshot }).metrics,
    );
    const unionMetrics = perQuestionResults.map(
      (row) => (row.union as { metrics: JudgeMetricSnapshot }).metrics,
    );

    const vectorAvg = averageJudgeMetrics(vectorMetrics);
    const unionAvg = averageJudgeMetrics(unionMetrics);

    const goldAddedAnalysis = perQuestionResults
      .filter((row) => (row.goldAddedByUnion as string[]).length > 0)
      .map((row) => ({
        questionId: row.questionId,
        goldAddedByUnion: row.goldAddedByUnion,
        impact: row.goldAddedImpact,
        vectorJudge: (row.vector as { judge: unknown }).judge,
        unionJudge: (row.union as { judge: unknown }).judge,
        vectorAnswer: (row.vector as { answer: string }).answer,
        unionAnswer: (row.union as { answer: string }).answer,
        vectorContext: (row.vector as { contextPreview: string }).contextPreview,
        unionContext: (row.union as { contextPreview: string }).contextPreview,
      }));

    const decision = classifyHybridGenerationDecision({
      cohortSize: perQuestionResults.length,
      vectorAvg,
      unionAvg,
      perQuestion: perQuestionResults.map((row) => ({
        vector: (row.vector as { metrics: JudgeMetricSnapshot }).metrics,
        union: (row.union as { metrics: JudgeMetricSnapshot }).metrics,
      })),
    });

    const payload = {
      metadata: {
        timestamp: new Date().toISOString(),
        sources: [SMOKE_DIR, HYBRID_PER_QUESTION],
        cohort: {
          size: cohort.length,
          skippedSameContext,
          questionIds: cohort.map((entry) => entry.questionId),
          tiers: cohort.reduce(
            (acc, entry) => {
              acc[entry.tier] = (acc[entry.tier] ?? 0) + 1;
              return acc;
            },
            {} as Record<string, number>,
          ),
        },
        config,
        models,
        apiCalls,
      },
      summary: {
        vector: vectorAvg,
        union: unionAvg,
        delta: {
          correctness: unionAvg.correctness - vectorAvg.correctness,
          completeness: unionAvg.completeness - vectorAvg.completeness,
          groundedness: unionAvg.groundedness - vectorAvg.groundedness,
          sourceRelevance: unionAvg.sourceRelevance - vectorAvg.sourceRelevance,
          sourceCoverage: unionAvg.sourceCoverage - vectorAvg.sourceCoverage,
        },
      },
      goldAddedAnalysis,
      decision,
      perQuestion: perQuestionResults,
    };

    const report = buildReport({
      cohort,
      vectorAvg,
      unionAvg,
      decision,
      goldAddedAnalysis,
      apiCalls,
      models,
    });

    await writeFile(join(OUTPUT_DIR, 'validation.json'), `${JSON.stringify(payload, null, 2)}\n`);
    await writeFile(
      join(OUTPUT_DIR, 'per-question.json'),
      `${JSON.stringify(perQuestionResults, null, 2)}\n`,
    );
    await writeFile(join(OUTPUT_DIR, 'REPORT.md'), report);

    console.log(`Decision: ${decision.category}`);
    console.log(`Production files modified: NO`);
    console.log(`OpenAI calls (this run): ${apiCalls.openai}`);
    console.log(`Generation calls (this run): ${apiCalls.generation}`);
    console.log(`Judge calls (this run): ${apiCalls.judge}`);
    console.log(`Source judge calls (this run): ${apiCalls.sourceJudge}`);
    console.log(`Output: ${OUTPUT_DIR}`);
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
