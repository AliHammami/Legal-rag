import type { PrismaService } from '../../prisma/prisma.service.js';
import type { PenalCodeChunkMetadata } from '../../chunking/types.js';
import { dynamicContextFilter } from '../../generation/dynamic-context-filter.js';
import { DEFAULT_RELATIVE_SCORE_THRESHOLD } from '../../generation/constants.js';
import type { RerankedChunk } from '../../reranking/types.js';
import type { GoldArticle } from '../gold-article.js';
import {
  goldArticlesPresent,
  simulateMinOneChunkPerRoutedCorpus,
  type QuestionQuotaAuditRecord,
} from './rerank-filter-quota-audit.js';

export const FILTER_BENCHMARK_VARIANTS = [
  'A_baseline_0.40',
  'B_threshold_0.25',
  'C_min1_corpus_0.40',
] as const;

export type FilterBenchmarkVariant = (typeof FILTER_BENCHMARK_VARIANTS)[number];

export const FILTER_VARIANT_LABELS: Record<FilterBenchmarkVariant, string> = {
  'A_baseline_0.40': 'A: 0.40',
  'B_threshold_0.25': 'B: 0.25',
  'C_min1_corpus_0.40': 'C: min1/corpus+0.40',
};

export interface CohortSelectionResult {
  questionIds: string[];
  rationale: Record<string, string>;
}

export interface JudgeScoreSnapshot {
  correctness: number;
  completeness: number;
  groundedness: number;
  abstentionCorrect: boolean;
  explanation: string;
}

export interface SourceJudgeScoreSnapshot {
  sourceRelevance: number;
  sourceCoverage: number;
  explanation: string;
}

export interface FilterVariantRunResult {
  variant: FilterBenchmarkVariant;
  filteredChunks: Array<{
    chunkId: string;
    corpusId: string;
    articleNumber: string;
    rerankScore: number;
  }>;
  corpusIds: string[];
  articleNumbers: string[];
  goldArticleHits: string[];
  contextChunkCount: number;
  answer: string;
  sources: Array<{
    sourceId: number;
    chunkId: string;
    corpusId: string;
    articleNumber: string;
  }>;
  generationMs: number;
  judge?: JudgeScoreSnapshot;
  sourceJudge?: SourceJudgeScoreSnapshot;
}

export interface FilterBenchmarkQuestionResult {
  questionId: string;
  question: string;
  classification: QuestionQuotaAuditRecord['classification'];
  routedCorpusIds: string[];
  goldArticles: QuestionQuotaAuditRecord['goldArticles'];
  variants: Record<FilterBenchmarkVariant, FilterVariantRunResult>;
}

export interface FilterBenchmarkAggregateRow {
  variant: FilterBenchmarkVariant;
  label: string;
  questionCount: number;
  avgCorrectness: number;
  avgCompleteness: number;
  avgGroundedness: number;
  abstentionCorrectRate: number;
  avgSourceRelevance: number;
  avgSourceCoverage: number;
  avgContextChunks: number;
  avgGoldArticleHits: number;
  avgRoutedCorpusCoverage: number;
}

export function applyFilterVariant(
  reranked: RerankedChunk[],
  routedCorpusIds: string[],
  variant: FilterBenchmarkVariant,
): RerankedChunk[] {
  switch (variant) {
    case 'A_baseline_0.40':
      return dynamicContextFilter(reranked, {
        relativeScoreThreshold: DEFAULT_RELATIVE_SCORE_THRESHOLD,
      });
    case 'B_threshold_0.25':
      return dynamicContextFilter(reranked, { relativeScoreThreshold: 0.25 });
    case 'C_min1_corpus_0.40':
      return simulateMinOneChunkPerRoutedCorpus(
        reranked,
        routedCorpusIds,
        DEFAULT_RELATIVE_SCORE_THRESHOLD,
      );
  }
}

function routedCorpusCount(
  chunks: Array<{ corpusId: string }>,
  routedCorpusIds: string[],
): number {
  const represented = new Set(chunks.map((chunk) => chunk.corpusId));
  return routedCorpusIds.filter((corpusId) => represented.has(corpusId)).length;
}

export function selectFilterBenchmarkCohort(
  records: QuestionQuotaAuditRecord[],
  size = 15,
): CohortSelectionResult {
  const selected = new Set<string>();
  const rationale: Record<string, string> = {};

  function add(record: QuestionQuotaAuditRecord, reason: string): void {
    if (selected.size >= size || selected.has(record.questionId)) {
      return;
    }
    selected.add(record.questionId);
    rationale[record.questionId] = reason;
  }

  const byId = new Map(records.map((record) => [record.questionId, record]));
  const q353 = byId.get('q353');
  if (q353) {
    add(q353, 'mandatory: class C, gold civil art.10 dropped at filter 0.4');
  }

  const classC = records.filter((r) => r.classification.byRoutedCorpus === 'C');
  const classB = records.filter((r) => r.classification.byRoutedCorpus === 'B');
  const classA = records.filter((r) => r.classification.byRoutedCorpus === 'A');

  const cWithGoldLoss = [...classC]
    .filter(
      (r) =>
        r.coverage.rerank.goldArticleHitCount >
        r.coverage.filter.goldArticleHitCount,
    )
    .sort(
      (left, right) =>
        right.coverage.rerank.goldArticleHitCount -
        left.coverage.rerank.goldArticleHitCount,
    );

  for (const record of cWithGoldLoss) {
    if (selected.size >= size) break;
    add(record, 'class C with gold article lost at filter 0.4');
  }

  for (const record of classC) {
    if (selected.size >= size) break;
    if (selected.size >= 7) break;
    add(record, 'class C (rerank bi-corpus, filter mono-corpus)');
  }

  for (const record of classB) {
    if (selected.size >= size) break;
    if ([...selected].filter((id) => byId.get(id)?.classification.byRoutedCorpus === 'B').length >= 4) {
      break;
    }
    add(record, 'class B (second corpus lost at rerank)');
  }

  for (const record of classA) {
    if (selected.size >= size) break;
    if ([...selected].filter((id) => byId.get(id)?.classification.byRoutedCorpus === 'A').length >= 3) {
      break;
    }
    add(record, 'class A (all stages pass at 0.4)');
  }

  for (const record of records) {
    if (selected.size >= size) break;
    add(record, 'fill: representative multicorpus cohort');
  }

  return {
    questionIds: [...selected],
    rationale,
  };
}

export async function hydrateRerankedChunksFromAudit(
  prisma: PrismaService,
  record: QuestionQuotaAuditRecord,
): Promise<RerankedChunk[]> {
  const keys = record.rerank.map((entry) => ({
    corpusId: entry.corpusId,
    chunkId: entry.chunkId,
  }));

  const rows = await prisma.legalCodeChunk.findMany({
    where: {
      OR: keys.map((key) => ({
        corpusId: key.corpusId,
        chunkId: key.chunkId,
      })),
    },
  });

  const rowByKey = new Map(
    rows.map((row) => [`${row.corpusId}::${row.chunkId}`, row]),
  );

  return record.rerank.map((entry) => {
    const row = rowByKey.get(`${entry.corpusId}::${entry.chunkId}`);
    if (!row) {
      throw new Error(
        `Missing chunk content for ${record.questionId}: ${entry.corpusId}/${entry.chunkId}`,
      );
    }

    const retrieval = record.retrieval.find(
      (candidate) => candidate.chunkId === entry.chunkId,
    );

    return {
      corpusId: entry.corpusId,
      chunkId: entry.chunkId,
      articleNumber: entry.articleNumber,
      content: row.content,
      distance: retrieval?.retrievalDistance ?? 0,
      rerankScore: entry.rerankScore,
      metadata: row.metadata as unknown as PenalCodeChunkMetadata,
    };
  });
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function aggregateFilterBenchmarkResults(
  results: FilterBenchmarkQuestionResult[],
): FilterBenchmarkAggregateRow[] {
  return FILTER_BENCHMARK_VARIANTS.map((variant) => {
    const runs = results.map((result) => result.variants[variant]);
    const judged = runs.filter((run) => run.judge !== undefined);
    const sourceJudged = runs.filter((run) => run.sourceJudge !== undefined);

    return {
      variant,
      label: FILTER_VARIANT_LABELS[variant],
      questionCount: runs.length,
      avgCorrectness: average(judged.map((run) => run.judge!.correctness)),
      avgCompleteness: average(judged.map((run) => run.judge!.completeness)),
      avgGroundedness: average(judged.map((run) => run.judge!.groundedness)),
      abstentionCorrectRate:
        judged.length === 0
          ? 0
          : (judged.filter((run) => run.judge!.abstentionCorrect).length /
              judged.length) *
            100,
      avgSourceRelevance: average(
        sourceJudged.map((run) => run.sourceJudge!.sourceRelevance),
      ),
      avgSourceCoverage: average(
        sourceJudged.map((run) => run.sourceJudge!.sourceCoverage),
      ),
      avgContextChunks: average(runs.map((run) => run.contextChunkCount)),
      avgGoldArticleHits: average(
        runs.map((run) => run.goldArticleHits.length),
      ),
      avgRoutedCorpusCoverage: average(
        results.map((result) =>
          routedCorpusCount(result.variants[variant].filteredChunks, result.routedCorpusIds),
        ),
      ),
    };
  });
}

function formatScore(value: number): string {
  return value.toFixed(2);
}

export function buildFilterBenchmarkReportMarkdown(input: {
  cohortQuestionIds: string[];
  cohortRationale: Record<string, string>;
  auditSourcePath: string;
  aggregates: FilterBenchmarkAggregateRow[];
  results: FilterBenchmarkQuestionResult[];
  judgeModel: string;
  generationModel: string;
}): string {
  const lines: string[] = [
    '# Benchmark filter multicorpus - 3 variantes',
    '',
    '## Cohorte',
    '',
    '```text',
    `${input.cohortQuestionIds.length} questions:`,
    input.cohortQuestionIds.join(', '),
    '```',
    '',
    '| questionId | selection | class routed |',
    '|------------|-----------|--------------|',
  ];

  for (const questionId of input.cohortQuestionIds) {
    const result = input.results.find((entry) => entry.questionId === questionId);
    lines.push(
      `| ${questionId} | ${input.cohortRationale[questionId] ?? 'n/a'} | ${result?.classification.byRoutedCorpus ?? 'n/a'} |`,
    );
  }

  lines.push(
    '',
    `Audit source (Jina scores reused, no re-rerank): \`${input.auditSourcePath}\``,
    `Generation model: \`${input.generationModel}\``,
    `Judge model: \`${input.judgeModel}\``,
    '',
    '## Resultats globaux',
    '',
    '| metric | A: 0.40 | B: 0.25 | C: min1/corpus |',
    '|--------|---------|---------|----------------|',
  );

  const byVariant = new Map(input.aggregates.map((row) => [row.variant, row]));
  const metrics: Array<{
    name: string;
    pick: (row: FilterBenchmarkAggregateRow) => string;
  }> = [
    { name: 'correctness', pick: (row) => formatScore(row.avgCorrectness) },
    { name: 'completeness', pick: (row) => formatScore(row.avgCompleteness) },
    { name: 'groundedness', pick: (row) => formatScore(row.avgGroundedness) },
    {
      name: 'abstention correct (%)',
      pick: (row) => formatScore(row.abstentionCorrectRate),
    },
    {
      name: 'source relevance',
      pick: (row) => formatScore(row.avgSourceRelevance),
    },
    {
      name: 'source coverage',
      pick: (row) => formatScore(row.avgSourceCoverage),
    },
    {
      name: 'avg chunks/context',
      pick: (row) => formatScore(row.avgContextChunks),
    },
    {
      name: 'avg gold articles in context',
      pick: (row) => formatScore(row.avgGoldArticleHits),
    },
    {
      name: 'avg routed corpus coverage (/2)',
      pick: (row) => formatScore(row.avgRoutedCorpusCoverage),
    },
  ];

  for (const metric of metrics) {
    lines.push(
      `| ${metric.name} | ${metric.pick(byVariant.get('A_baseline_0.40')!)} | ${metric.pick(byVariant.get('B_threshold_0.25')!)} | ${metric.pick(byVariant.get('C_min1_corpus_0.40')!)} |`,
    );
  }

  lines.push('', '## Cas individuels notables', '');

  const findBest = (
    metric: 'correctness' | 'completeness' | 'groundedness' | 'sourceCoverage',
  ): { questionId: string; variant: FilterBenchmarkVariant; score: number } | null => {
    let best: { questionId: string; variant: FilterBenchmarkVariant; score: number } | null =
      null;

    for (const result of input.results) {
      for (const variant of FILTER_BENCHMARK_VARIANTS) {
        const run = result.variants[variant];
        const score =
          metric === 'sourceCoverage'
            ? run.sourceJudge?.sourceCoverage
            : run.judge?.[metric];
        if (score === undefined) continue;
        if (!best || score > best.score) {
          best = { questionId: result.questionId, variant, score };
        }
      }
    }

    return best;
  };

  const cWin = findBest('completeness');
  const bWin = findBest('sourceCoverage');
  const examples = [
    {
      title: 'C potentially improves (completeness)',
      entry: input.results.find((r) => r.questionId === 'q353'),
      variant: 'C_min1_corpus_0.40' as const,
    },
    {
      title: 'B potentially improves (source coverage)',
      entry: input.results.find((r) => r.classification.byRoutedCorpus === 'C'),
      variant: 'B_threshold_0.25' as const,
    },
    {
      title: 'A sufficient (class A)',
      entry: input.results.find((r) => r.classification.byRoutedCorpus === 'A'),
      variant: 'A_baseline_0.40' as const,
    },
    {
      title: 'C adds noise risk (more chunks, lower groundedness)',
      entry: input.results.find((r) => r.classification.byRoutedCorpus === 'C'),
      variant: 'C_min1_corpus_0.40' as const,
    },
    {
      title: 'Rerank-limited (class B)',
      entry: input.results.find((r) => r.classification.byRoutedCorpus === 'B'),
      variant: 'A_baseline_0.40' as const,
    },
  ];

  for (const example of examples) {
    if (!example.entry) continue;
    const run = example.entry.variants[example.variant];
    lines.push(
      `### ${example.title}`,
      '',
      `- **${example.entry.questionId}** / ${FILTER_VARIANT_LABELS[example.variant]}`,
      `- Chunks: ${run.contextChunkCount} | corpora: ${run.corpusIds.join(', ')}`,
      `- Judge: correctness=${run.judge?.correctness ?? 'n/a'}, completeness=${run.judge?.completeness ?? 'n/a'}, groundedness=${run.judge?.groundedness ?? 'n/a'}`,
      `- Source judge: relevance=${run.sourceJudge?.sourceRelevance ?? 'n/a'}, coverage=${run.sourceJudge?.sourceCoverage ?? 'n/a'}`,
      `- Gold in context: ${run.goldArticleHits.join(', ') || 'none'}`,
      '',
    );
  }

  const aggA = byVariant.get('A_baseline_0.40')!;
  const aggB = byVariant.get('B_threshold_0.25')!;
  const aggC = byVariant.get('C_min1_corpus_0.40')!;

  lines.push(
    '## Decision',
    '',
    'Based on judge scores (not corpus count alone):',
    '',
  );

  const qualityScore = (row: FilterBenchmarkAggregateRow) =>
    row.avgCorrectness + row.avgCompleteness + row.avgGroundedness;
  const scores = [
    { label: 'A', score: qualityScore(aggA) },
    { label: 'B', score: qualityScore(aggB) },
    { label: 'C', score: qualityScore(aggC) },
  ].sort((left, right) => right.score - left.score);

  lines.push(
    `1. Quality sum (correctness+completeness+groundedness): ${scores.map((entry) => `${entry.label}=${entry.score.toFixed(2)}`).join(', ')}`,
    `2. Source coverage avg: A=${formatScore(aggA.avgSourceCoverage)}, B=${formatScore(aggB.avgSourceCoverage)}, C=${formatScore(aggC.avgSourceCoverage)}`,
    `3. Context size avg: A=${formatScore(aggA.avgContextChunks)}, B=${formatScore(aggB.avgContextChunks)}, C=${formatScore(aggC.avgContextChunks)}`,
    '',
    'See `results.json` for per-question answers and full judge explanations.',
    '',
  );

  if (cWin) {
    lines.push(
      `- Best single completeness: ${cWin.questionId} (${FILTER_VARIANT_LABELS[cWin.variant]}, ${cWin.score})`,
    );
  }
  if (bWin) {
    lines.push(
      `- Best single source coverage: ${bWin.questionId} (${FILTER_VARIANT_LABELS[bWin.variant]}, ${bWin.score})`,
    );
  }

  return `${lines.join('\n')}\n`;
}

export function goldArticlesInFilteredChunks(
  filtered: RerankedChunk[],
  goldArticles: QuestionQuotaAuditRecord['goldArticles'],
): string[] {
  return goldArticlesPresent(filtered, goldArticles).map(
    (article: GoldArticle) => `${article.corpusId}:${article.articleNumber}`,
  );
}
