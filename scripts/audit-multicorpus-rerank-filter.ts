/**
 * Read-only forensic audit. Does not modify production code.
 * Combines quota-smoke corpus metrics with detailed rerank/filter traces
 * from the pre-quota forensic replay (same question IDs, different retrieval input).
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import { dynamicContextFilter } from '../src/generation/dynamic-context-filter.js';
import { computeRelativeScore } from '../src/generation/dynamic-context-filter.js';
import { loadMulticorpusEvaluationDataset } from '../src/evaluation/load-multicorpus-dataset.js';
import { DEFAULT_MULTICORPUS_EVALUATION_DATASET_PATH } from '../src/evaluation/constants.js';
import { DEFAULT_MULTICORPUS_RESULTS_DIR } from '../src/evaluation/multicorpus/evaluation-config.js';
import type { GoldArticle } from '../src/evaluation/gold-article.js';
import type { RerankedChunk } from '../src/reranking/types.js';

interface SmokePerQuestion {
  questionId: string;
  routedCorpusIds: string[];
  candidateCount: number;
  rerankCount: number;
  filterCount: number;
  corpusCoverage: { retrieval: number; rerank: number; filter: number };
  goldArticles: GoldArticle[];
}

interface ForensicCase {
  id: string;
  question: string;
  goldArticles: GoldArticle[];
  goldCorpusIds: string[];
  retrievalTop20: Array<{
    corpusId: string;
    articleNumber: string;
    distance?: number;
  }>;
  rerankTop5: Array<{
    corpusId: string;
    articleNumber: string;
    rerankScore: number;
  }>;
  filteredContext: Array<{
    corpusId: string;
    articleNumber: string;
    rerankScore: number;
  }>;
}

type Classification = 'A' | 'B' | 'C' | 'D';

function corpusSet(chunks: Array<{ corpusId: string }>): Set<string> {
  return new Set(chunks.map((chunk) => chunk.corpusId));
}

function goldHits(
  chunks: Array<{ corpusId: string; articleNumber: string }>,
  goldArticles: GoldArticle[],
): number {
  return goldArticles.filter((gold) =>
    chunks.some(
      (chunk) =>
        chunk.corpusId === gold.corpusId &&
        chunk.articleNumber === gold.articleNumber,
    ),
  ).length;
}

function classifyCorpusCoverage(coverage: {
  retrieval: number;
  rerank: number;
  filter: number;
}): Classification {
  if (coverage.filter === 2) return 'A';
  if (coverage.retrieval === 2 && coverage.rerank === 1) return 'B';
  if (coverage.retrieval === 2 && coverage.rerank === 2 && coverage.filter === 1) {
    return 'C';
  }
  if (coverage.filter === 2) return 'D';
  return 'D';
}

function toRerankedChunks(
  entries: ForensicCase['rerankTop5'],
): RerankedChunk[] {
  return entries.map((entry, index) => ({
    corpusId: entry.corpusId,
    chunkId: `${entry.corpusId}:${entry.articleNumber}:${index}`,
    articleNumber: entry.articleNumber,
    content: '',
    distance: 0,
    rerankScore: entry.rerankScore,
    metadata: {
      articleNumber: entry.articleNumber,
      pageStart: 0,
      pageEnd: 0,
      source: '',
      sourceType: 'pdf' as const,
      chunkIndex: 0,
      chunkCount: 1,
      unitStart: 0,
      unitEnd: 0,
      unitCount: 1,
    },
  }));
}

function simulateFilterThreshold(
  rerankTop5: ForensicCase['rerankTop5'],
  threshold: number,
): RerankedChunk[] {
  return dynamicContextFilter(toRerankedChunks(rerankTop5), {
    relativeScoreThreshold: threshold,
  });
}

async function main(): Promise<void> {
  const smokePath = join(
    DEFAULT_MULTICORPUS_RESULTS_DIR,
    'multicorpus-quota-smoke-2026-09-20T23-05-17-065Z',
    'multicorpus-quota-smoke.json',
  );
  const forensicPath = '/tmp/penal-e2e-forensic-output.json';
  const outputDir = join(
    DEFAULT_MULTICORPUS_RESULTS_DIR,
    'multicorpus-rerank-filter-audit-2026-09-20',
  );

  const [smokeRaw, forensicRaw, questions] = await Promise.all([
    readFile(smokePath, 'utf-8'),
    readFile(forensicPath, 'utf-8'),
    loadMulticorpusEvaluationDataset(DEFAULT_MULTICORPUS_EVALUATION_DATASET_PATH),
  ]);

  const smoke = JSON.parse(smokeRaw) as { perQuestion: SmokePerQuestion[] };
  const forensic = JSON.parse(forensicRaw) as { multiForensics: ForensicCase[] };
  const forensicById = new Map(forensic.multiForensics.map((entry) => [entry.id, entry]));
  const questionById = new Map(questions.map((question) => [question.id, question]));

  const thresholds = [0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5];
  const thresholdRows: Array<Record<string, number | string>> = [];

  const rows: Array<Record<string, unknown>> = [];
  const counts = { A: 0, B: 0, C: 0, D: 0 };

  for (const entry of smoke.perQuestion) {
    const classification = classifyCorpusCoverage(entry.corpusCoverage);
    counts[classification] += 1;

    const forensicCase = forensicById.get(entry.questionId);
    const question = questionById.get(entry.questionId);

    const forensicGold = {
      retrieval: forensicCase
        ? goldHits(forensicCase.retrievalTop20, entry.goldArticles)
        : null,
      rerank: forensicCase
        ? goldHits(forensicCase.rerankTop5, entry.goldArticles)
        : null,
      filter: forensicCase
        ? goldHits(forensicCase.filteredContext, entry.goldArticles)
        : null,
    };

    rows.push({
      questionId: entry.questionId,
      question: question?.question ?? forensicCase?.question,
      goldCorpora: entry.goldArticles.map((gold) => gold.corpusId),
      quotaSmoke: entry.corpusCoverage,
      classification,
      goldArticles: entry.goldArticles,
      goldArticleHitsForensicBaseline: forensicGold,
      forensicRetrievalCorpora: forensicCase
        ? [...corpusSet(forensicCase.retrievalTop20)]
        : null,
      forensicRerankCorpora: forensicCase
        ? [...corpusSet(forensicCase.rerankTop5)]
        : null,
      forensicFilterCorpora: forensicCase
        ? [...corpusSet(forensicCase.filteredContext)]
        : null,
      forensicRerankTop5: forensicCase?.rerankTop5,
      forensicFilteredContext: forensicCase?.filteredContext,
    });
  }

  const forensicOverlap = smoke.perQuestion
    .map((entry) => forensicById.get(entry.questionId))
    .filter((entry): entry is ForensicCase => entry !== undefined);

  for (const threshold of thresholds) {
    let bothCorpora = 0;
    let oneCorpus = 0;
    let goldHitsTotal = 0;
    let goldTotal = 0;

    for (const entry of forensicOverlap) {
      const smokeEntry = smoke.perQuestion.find((row) => row.questionId === entry.id)!;
      const filtered = simulateFilterThreshold(entry.rerankTop5, threshold);
      const corpusCount = corpusSet(filtered).size;
      if (corpusCount === 2) bothCorpora += 1;
      else if (corpusCount === 1) oneCorpus += 1;
      goldHitsTotal += goldHits(filtered, smokeEntry.goldArticles);
      goldTotal += smokeEntry.goldArticles.length;
    }

    thresholdRows.push({
      threshold,
      twoCorpora: bothCorpora,
      oneCorpus,
      zeroCorpus: forensicOverlap.length - bothCorpora - oneCorpus,
      goldArticleRecall: goldTotal > 0 ? goldHitsTotal / goldTotal : 0,
      goldHits: goldHitsTotal,
      goldTotal,
    });
  }

  const bExamples = rows.filter((row) => row.classification === 'B').slice(0, 3);
  const cExamples = rows.filter((row) => row.classification === 'C').slice(0, 3);

  const report = {
    metadata: {
      smokeRun: smokePath,
      forensicSource: forensicPath,
      forensicCaveat:
        'Detailed rerank scores and filter simulation use pre-quota baseline retrieval from forensic replay; quota-smoke corpus counts use post-quota retrieval.',
      questionCount: smoke.perQuestion.length,
    },
    summary: {
      corpusClassification: counts,
      quotaSmoke: {
        retrievalBoth: smoke.perQuestion.filter(
          (row) => row.corpusCoverage.retrieval === 2,
        ).length,
        rerankBoth: smoke.perQuestion.filter((row) => row.corpusCoverage.rerank === 2)
          .length,
        filterBoth: smoke.perQuestion.filter((row) => row.corpusCoverage.filter === 2)
          .length,
      },
      losses: {
        atRerankCorpus: counts.B,
        atFilterCorpusAmongRerankBoth: counts.C,
      },
    },
    perQuestion: rows,
    thresholdSimulationOnForensicRerank: thresholdRows,
    examples: { B: bExamples, C: cExamples },
  };

  await mkdir(outputDir, { recursive: true });
  const outPath = join(outputDir, 'audit.json');
  await writeFile(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf-8');

  console.log(JSON.stringify(report.summary, null, 2));
  console.log('\nThreshold simulation (forensic rerank top-5):');
  for (const row of thresholdRows) {
    console.log(
      `${row.threshold}\t2corp=${row.twoCorpora}\t1corp=${row.oneCorpus}\tgold=${row.goldHits}/${row.goldTotal} (${(Number(row.goldArticleRecall) * 100).toFixed(1)}%)`,
    );
  }
  console.log(`\nWritten: ${outPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
