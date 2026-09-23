import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { retrieveBm25QuotaAtK } from '../src/evaluation/multicorpus/retrieval-hybrid-bm25.js';
import {
  DEFAULT_HYBRID_RRF_K,
  dedupeUnionCandidates,
  reciprocalRankFusion,
  truncateRankedAtK,
} from '../src/evaluation/multicorpus/retrieval-hybrid-fusion.js';
import {
  candidateCountStats,
  computeGoldContribution,
  goldHitsInList,
  rankMapForGold,
  summarizeVariantAt50,
} from '../src/evaluation/multicorpus/retrieval-hybrid-metrics.js';
import type { RankedRetrievalChunk } from '../src/evaluation/multicorpus/retrieval-depth-benchmark.js';
import { firstRankForGold } from '../src/evaluation/multicorpus/retrieval-depth-benchmark.js';
import type { GoldArticle } from '../src/evaluation/gold-article.js';
import { goldArticlesMatch } from '../src/evaluation/gold-article.js';

const DEPTH_DIR = join(
  'reports/evaluation/runs',
  'retrieval-depth-benchmark-2026-09-22',
);
const SEMANTIC_DIR = join(
  'reports/evaluation/runs',
  'retrieval-semantic-diagnostic-2026-09-22',
);
const OUTPUT_DIR = join(
  'reports/evaluation/runs',
  'retrieval-hybrid-benchmark-2026-09-22',
);

interface PerQuestionDepth {
  questionId: string;
  question: string;
  questionType: string;
  routedCorpusIds: string[];
  goldArticles: GoldArticle[];
  quota: { byK: Record<string, RankedRetrievalChunk[]> };
}

interface AbsentGoldRow {
  questionId: string;
  gold: GoldArticle;
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function normalizeVectorTop50(rows: RankedRetrievalChunk[]): RankedRetrievalChunk[] {
  return rows.slice(0, 50).map((row, index) => ({
    ...row,
    rank: index + 1,
  }));
}

function buildReport(input: {
  summary: Record<string, unknown>;
  absent29: unknown[];
  conclusion: string;
  nextExperiment: string;
}): string {
  const summary = input.summary as {
    variants: Record<
      string,
      {
        goldRecall: number;
        fullCoverageRate: number;
        corpusCoverageRate: number;
        bm25OnlyGoldArticles?: number;
        candidateStats?: ReturnType<typeof candidateCountStats>;
        rrfPreTruncationMean?: number;
      }
    >;
    absent29Table: Array<{
      questionId: string;
      gold: string;
      bm25Hit: boolean;
      unionHit: boolean;
      rrfHit: boolean;
      bm25Rank: number | null;
      rrfRank: number | null;
      bm25Only: boolean;
    }>;
    validation: Record<string, string | number>;
  };

  const variantRows = ['vector', 'bm25', 'union', 'rrf']
    .map((key) => {
      const row = summary.variants[key]!;
      const bm25Only =
        key === 'union' || key === 'rrf'
          ? String(row.bm25OnlyGoldArticles ?? 0)
          : '-';
      return `| ${key.toUpperCase()} | ${pct(row.goldRecall)} | ${pct(row.fullCoverageRate)} | ${pct(row.corpusCoverageRate)} | ${bm25Only} |`;
    })
    .join('\n');

  const absentRows = summary.absent29Table
    .map(
      (row) =>
        `| ${row.questionId} | ${row.gold} | ${row.bm25Hit} | ${row.unionHit} | ${row.rrfHit} | ${row.bm25Rank ?? '>50'} | ${row.rrfRank ?? '>50'} | ${row.bm25Only} |`,
    )
    .join('\n');

  const unionStats = summary.variants.union?.candidateStats;
  const rrfStats = summary.variants.rrf?.candidateStats;

  return `# Benchmark hybrid retrieval (offline)

## Validation

- API calls: ${summary.validation.apiCalls}
- Jina calls: ${summary.validation.jinaCalls}
- LLM calls: ${summary.validation.llmCalls}
- Generation calls: ${summary.validation.generationCalls}
- Production behavior modified: ${summary.validation.productionModified}

## Configuration

- Cohorte: 61 questions (\`retrieval-depth-benchmark-2026-09-22\`)
- Vector: \`per-question.json\` quota top50 (reference, pas recalcule)
- BM25: quota multicorpus aligne (\`ceil(k/n)\` par corpus), chunks \`data/processed/\`
- Union: dedup chunkId vector50 + bm25top50
- RRF: \`RRF(d) = sum 1/(k + rank_i(d))\`, k=${DEFAULT_HYBRID_RRF_K}, puis top50

## Comparaison @50 (61 questions)

| Variante | Gold recall @50 | Full coverage | Corpus coverage | Golds BM25-only recuperes |
| -------- | --------------: | ------------: | --------------: | ------------------------: |
${variantRows}

### Candidats uniques (Union / RRF)

| Variante | mean | median | min | max |
|----------|-----:|-------:|----:|----:|
| Union | ${unionStats?.mean.toFixed(1) ?? '-'} | ${unionStats?.median.toFixed(0) ?? '-'} | ${unionStats?.min ?? '-'} | ${unionStats?.max ?? '-'} |
| RRF (pre-truncation pool) | ${rrfStats?.mean.toFixed(1) ?? '-'} | ${rrfStats?.median.toFixed(0) ?? '-'} | ${rrfStats?.min ?? '-'} | ${rrfStats?.max ?? '-'} |

## 29 golds absents vector @50

| questionId | gold | BM25 | Union | RRF | rank BM25 | rank RRF | BM25-only |
|------------|------|:----:|:-----:|:---:|:---------:|:--------:|:---------:|
${absentRows}

## Conclusion

${input.conclusion}

## Prochaine experience

${input.nextExperiment}
`;
}

async function main(): Promise<void> {
  const [benchmarkRaw, perQuestionRaw, semanticRaw] = await Promise.all([
    readFile(join(DEPTH_DIR, 'benchmark.json'), 'utf-8'),
    readFile(join(DEPTH_DIR, 'per-question.json'), 'utf-8'),
    readFile(join(SEMANTIC_DIR, 'diagnostic.json'), 'utf-8').catch(() => '{}'),
  ]);

  const benchmark = JSON.parse(benchmarkRaw) as {
    dataset: { questionIds: string[] };
    summary: {
      quota: { rows: Array<{ k: number; goldRecall: number }> };
      goldRankDetailsQuota: Array<{
        questionId: string;
        gold: GoldArticle;
        absentAt20: boolean;
        depthBand: string;
      }>;
    };
  };
  const perQuestion = JSON.parse(perQuestionRaw) as PerQuestionDepth[];
  const semantic = JSON.parse(semanticRaw) as {
    cases?: Array<{ questionId: string; goldArticle: GoldArticle }>;
  };

  const perQuestionById = new Map(
    perQuestion.map((record) => [record.questionId, record]),
  );

  const absent29: AbsentGoldRow[] =
    semantic.cases?.map((item) => ({
      questionId: item.questionId,
      gold: item.goldArticle,
    })) ??
    benchmark.summary.goldRankDetailsQuota
      .filter(
        (detail) => detail.absentAt20 && detail.depthBand === 'absent_at_50',
      )
      .map((detail) => ({
        questionId: detail.questionId,
        gold: detail.gold,
      }));

  if (absent29.length !== 29) {
    throw new Error(`Expected 29 absent-at-50 golds, got ${absent29.length}`);
  }

  const questionResults = [];
  let totalBm25OnlyAcrossQuestions = 0;
  let totalBm25OnlyRecoveredUnion = 0;
  let totalBm25OnlyRecoveredRrf = 0;

  const unionCounts: number[] = [];
  const rrfPoolCounts: number[] = [];

  for (const questionId of benchmark.dataset.questionIds) {
    const record = perQuestionById.get(questionId);
    if (!record) {
      throw new Error(`Missing per-question ${questionId}`);
    }

    const vectorTop50 = normalizeVectorTop50(record.quota.byK['50'] ?? []);
    const bm25Top50 = await retrieveBm25QuotaAtK({
      question: record.question,
      routedCorpusIds: record.routedCorpusIds,
      k: 50,
    });
    const unionCandidates = dedupeUnionCandidates(vectorTop50, bm25Top50);
    const rrfFull = reciprocalRankFusion([
      { name: 'vector', ranked: vectorTop50 },
      { name: 'bm25', ranked: bm25Top50 },
    ]);
    const rrfTop50 = truncateRankedAtK(rrfFull, 50);

    unionCounts.push(unionCandidates.length);
    rrfPoolCounts.push(rrfFull.length);

    const goldCorpusIds = [
      ...new Set(record.goldArticles.map((gold) => gold.corpusId)),
    ].sort();

    const contribution = computeGoldContribution(
      record.goldArticles,
      vectorTop50,
      bm25Top50,
    );
    totalBm25OnlyAcrossQuestions += contribution.bm25Only.length;

    const bm25OnlyRecoveredUnion = contribution.bm25Only.filter((gold) =>
      unionCandidates.some((chunk) => goldArticlesMatch(gold, chunk)),
    ).length;
    const bm25OnlyRecoveredRrf = contribution.bm25Only.filter((gold) =>
      rrfTop50.some((chunk) => goldArticlesMatch(gold, chunk)),
    ).length;
    totalBm25OnlyRecoveredUnion += bm25OnlyRecoveredUnion;
    totalBm25OnlyRecoveredRrf += bm25OnlyRecoveredRrf;

    questionResults.push({
      questionId,
      questionType: record.questionType,
      goldArticles: record.goldArticles,
      goldCorpusIds,
      routedCorpusIds: record.routedCorpusIds,
      vectorGoldHits: goldHitsInList(record.goldArticles, vectorTop50).length,
      bm25GoldHits: goldHitsInList(record.goldArticles, bm25Top50).length,
      unionGoldHits: goldHitsInList(record.goldArticles, unionCandidates).length,
      rrfGoldHits: goldHitsInList(record.goldArticles, rrfTop50).length,
      goldArticlesVectorOnly: contribution.vectorOnly,
      goldArticlesBm25Only: contribution.bm25Only,
      goldArticlesBoth: contribution.both,
      vectorRanks: rankMapForGold(record.goldArticles, vectorTop50),
      bm25Ranks: rankMapForGold(record.goldArticles, bm25Top50),
      rrfRanks: rankMapForGold(record.goldArticles, rrfTop50),
      unionCandidateCount: unionCandidates.length,
      rrfPoolCount: rrfFull.length,
      lists: {
        vectorTop50,
        bm25Top50,
        unionCandidates,
        rrfTop50,
      },
    });
  }

  const variantInputs = {
    vector: questionResults.map((result) => ({
      questionType: result.questionType,
      goldArticles: result.goldArticles,
      goldCorpusIds: result.goldCorpusIds,
      chunks: result.lists.vectorTop50,
    })),
    bm25: questionResults.map((result) => ({
      questionType: result.questionType,
      goldArticles: result.goldArticles,
      goldCorpusIds: result.goldCorpusIds,
      chunks: result.lists.bm25Top50,
    })),
    union: questionResults.map((result) => ({
      questionType: result.questionType,
      goldArticles: result.goldArticles,
      goldCorpusIds: result.goldCorpusIds,
      chunks: result.lists.unionCandidates,
      useFullListForRecall: true,
    })),
    rrf: questionResults.map((result) => ({
      questionType: result.questionType,
      goldArticles: result.goldArticles,
      goldCorpusIds: result.goldCorpusIds,
      chunks: result.lists.rrfTop50,
    })),
  };

  const vectorSummary = summarizeVariantAt50({ results: variantInputs.vector });
  const bm25Summary = summarizeVariantAt50({ results: variantInputs.bm25 });
  const unionSummary = summarizeVariantAt50({ results: variantInputs.union });
  const rrfSummary = summarizeVariantAt50({ results: variantInputs.rrf });

  const refVectorRecall =
    benchmark.summary.quota.rows.find((row) => row.k === 50)?.goldRecall ?? 0;

  const absent29Table = absent29.map((row) => {
    const result = questionResults.find((item) => item.questionId === row.questionId)!;
    const bm25Rank = firstRankForGold(row.gold, result.lists.bm25Top50);
    const rrfRank = firstRankForGold(row.gold, result.lists.rrfTop50);
    const vectorHit = result.lists.vectorTop50.some((chunk) =>
      goldArticlesMatch(row.gold, chunk),
    );
    const bm25Hit = bm25Rank !== null;
    const unionHit = result.lists.unionCandidates.some((chunk) =>
      goldArticlesMatch(row.gold, chunk),
    );
    const rrfHit = rrfRank !== null;
    return {
      questionId: row.questionId,
      gold: `${row.gold.corpusId}:${row.gold.articleNumber}`,
      bm25Hit,
      unionHit,
      rrfHit,
      bm25Rank,
      rrfRank,
      bm25Only: !vectorHit && bm25Hit,
    };
  });

  const absentBm25Hits = absent29Table.filter((row) => row.bm25Hit).length;
  const absentUnionHits = absent29Table.filter((row) => row.unionHit).length;
  const absentRrfHits = absent29Table.filter((row) => row.rrfHit).length;

  let conclusion = `Vector @50=${pct(vectorSummary.goldRecall)} (reference benchmark ${pct(refVectorRecall)}). BM25 @50=${pct(bm25Summary.goldRecall)}. Union=${pct(unionSummary.goldRecall)}. RRF=${pct(rrfSummary.goldRecall)}. Sur les 29 golds vector-absents: BM25 ${absentBm25Hits}/29, Union ${absentUnionHits}/29, RRF ${absentRrfHits}/29.`;
  if (bm25Summary.goldRecall > vectorSummary.goldRecall) {
    conclusion += ` BM25 apporte ${bm25Summary.goldHits - vectorSummary.goldHits} hits gold supplementaires vs vector.`;
  }
  if (unionSummary.goldRecall >= bm25Summary.goldRecall) {
    conclusion += ' Union conserve l integralite des gains BM25 (recall >= BM25 seul).';
  }
  if (rrfSummary.goldRecall < unionSummary.goldRecall) {
    conclusion += ' RRF top50 perd des golds vs Union (truncation/classement).';
  } else if (rrfSummary.goldRecall >= bm25Summary.goldRecall) {
    conclusion += ' RRF conserve les gains BM25 dans le top50.';
  }

  let nextExperiment =
    'Mini-benchmark hybrid en pipeline (vector+BM25 RRF @50) avec rerank Jina sur 61q � uniquement si RRF ou Union bat vector de facon nette.';
  if (rrfSummary.goldRecall >= unionSummary.goldRecall) {
    nextExperiment =
      'Experimenter RRF @50 (k=60) dans un smoke rerank+filter 61q sans changer prod retrieval.';
  } else if (unionSummary.goldRecall > vectorSummary.goldRecall) {
    nextExperiment =
      'Experimenter Union/RRF avec K candidats >50 avant Jina sur sous-cohorte multicorpus.';
  }

  const payload = {
    metadata: {
      timestamp: new Date().toISOString(),
      cohortQuestionIds: benchmark.dataset.questionIds,
      sources: [
        join(DEPTH_DIR, 'benchmark.json'),
        join(DEPTH_DIR, 'per-question.json'),
        'data/processed/*.chunks.json',
      ],
      rrfFormula: `RRF(d) = sum_i 1/(k + rank_i(d)), k=${DEFAULT_HYBRID_RRF_K}`,
      validation: {
        apiCalls: 0,
        jinaCalls: 0,
        llmCalls: 0,
        generationCalls: 0,
        productionModified: 'NO',
      },
    },
    summary: {
      variants: {
        vector: {
          ...vectorSummary,
          bm25OnlyGoldArticles: 0,
        },
        bm25: {
          ...bm25Summary,
          bm25OnlyGoldArticles: totalBm25OnlyAcrossQuestions,
        },
        union: {
          ...unionSummary,
          bm25OnlyGoldArticles: totalBm25OnlyRecoveredUnion,
          candidateStats: candidateCountStats(unionCounts),
        },
        rrf: {
          ...rrfSummary,
          bm25OnlyGoldArticles: totalBm25OnlyRecoveredRrf,
          candidateStats: candidateCountStats(rrfPoolCounts),
        },
      },
      contribution: {
        bm25OnlyGoldArticlesTotal: totalBm25OnlyAcrossQuestions,
        bm25OnlyRecoveredInUnion: totalBm25OnlyRecoveredUnion,
        bm25OnlyRecoveredInRrf: totalBm25OnlyRecoveredRrf,
      },
      absent29: {
        bm25Hits: absentBm25Hits,
        unionHits: absentUnionHits,
        rrfHits: absentRrfHits,
        table: absent29Table,
      },
      referenceVectorRecallAt50: refVectorRecall,
    },
    perQuestion: questionResults.map(({ lists, ...rest }) => rest),
    listsByQuestion: Object.fromEntries(
      questionResults.map((result) => [
        result.questionId,
        result.lists,
      ]),
    ),
  };

  await mkdir(OUTPUT_DIR, { recursive: true });
  const report = buildReport({
    summary: {
      variants: payload.summary.variants,
      absent29Table,
      validation: payload.metadata.validation,
    },
    absent29: absent29Table,
    conclusion,
    nextExperiment,
  });

  await writeFile(
    join(OUTPUT_DIR, 'benchmark.json'),
    `${JSON.stringify(payload, null, 2)}\n`,
  );
  await writeFile(
    join(OUTPUT_DIR, 'per-question.json'),
    `${JSON.stringify(questionResults.map(({ lists, ...rest }) => rest), null, 2)}\n`,
  );
  await writeFile(join(OUTPUT_DIR, 'REPORT.md'), report);

  console.log(`Vector recall @50: ${pct(vectorSummary.goldRecall)}`);
  console.log(`BM25 recall @50: ${pct(bm25Summary.goldRecall)}`);
  console.log(`Union recall: ${pct(unionSummary.goldRecall)}`);
  console.log(`RRF recall @50: ${pct(rrfSummary.goldRecall)}`);
  console.log(`Absent29 BM25: ${absentBm25Hits}/29`);
  console.log(`Output: ${OUTPUT_DIR}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
