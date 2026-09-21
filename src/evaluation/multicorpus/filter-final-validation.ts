import {
  computeRelativeScore,
  dynamicContextFilter,
} from '../../generation/dynamic-context-filter.js';
import {
  DEFAULT_RELATIVE_SCORE_THRESHOLD,
  MAX_CONTEXT_CHUNKS,
} from '../../generation/constants.js';
import type { RerankedChunk } from '../../reranking/types.js';
import {
  goldCorpusIdsFromArticles,
  type GoldArticle,
} from '../gold-article.js';
import {
  goldArticlesPresent,
  type QuestionQuotaAuditRecord,
} from './rerank-filter-quota-audit.js';
import type {
  FilterVariantRunResult,
  JudgeScoreSnapshot,
  SourceJudgeScoreSnapshot,
} from './filter-variant-benchmark.js';

export const FINAL_VALIDATION_MANDATORY_IDS = [
  'q353',
  'q365',
  'q372',
  'q377',
  'q380',
  'q396',
  'q410',
  'q361',
  'q374',
  'q375',
  'q378',
  'q362',
  'q363',
  'q371',
  'q352',
] as const;

export const FINAL_VALIDATION_VARIANTS = [
  'A_baseline_0.40',
  'B_conditional_min1_0.40',
] as const;

export type FinalValidationVariant = (typeof FINAL_VALIDATION_VARIANTS)[number];

export const FINAL_VALIDATION_LABELS: Record<FinalValidationVariant, string> = {
  'A_baseline_0.40': 'A: threshold 0.40',
  'B_conditional_min1_0.40': 'B: conditional min1/corpus @ 0.40',
};

export interface FinalValidationCohortSelection {
  questionIds: string[];
  rationale: Record<string, string>;
  composition: {
    classA: number;
    classB: number;
    classC: number;
    other: number;
  };
}

export interface FilterStageDiagnostics {
  routedCorpusIds: string[];
  goldCorpusIds: string[];
  retrievalRoutedCorpusCount: number;
  rerankRoutedCorpusCount: number;
  filterRoutedCorpusCount: number;
  retrievalGoldCorpusCount: number;
  rerankGoldCorpusCount: number;
  filterGoldCorpusCount: number;
  rerankTop5: Array<{
    rank: number;
    chunkId: string;
    corpusId: string;
    articleNumber: string;
    rerankScore: number;
  }>;
  filterDetails: Array<{
    chunkId: string;
    corpusId: string;
    articleNumber: string;
    rerankScore: number;
    relativeScore: number;
    kept: boolean;
  }>;
  chunksBeforeFilter: number;
  chunksAfterFilter: number;
  removedChunks: Array<{
    chunkId: string;
    corpusId: string;
    articleNumber: string;
    rerankScore: number;
    relativeScore: number;
  }>;
  goldArticlesInContext: string[];
  allGoldCorporaPresent: boolean;
}

export interface FinalValidationQuestionResult {
  questionId: string;
  question: string;
  classification: QuestionQuotaAuditRecord['classification'];
  routedCorpusIds: string[];
  goldArticles: GoldArticle[];
  goldCorpusIds: string[];
  variants: Record<
    FinalValidationVariant,
    FilterVariantRunResult & { diagnostics: FilterStageDiagnostics }
  >;
}

export interface FinalValidationAggregateRow {
  variant: FinalValidationVariant;
  label: string;
  questionCount: number;
  avgCorrectness: number;
  avgCompleteness: number;
  avgGroundedness: number;
  abstentionCorrectRate: number;
  avgSourceRelevance: number;
  avgSourceCoverage: number;
  avgContextChunks: number;
  medianContextChunks: number;
  avgGoldArticleHits: number;
  goldArticleRecall: number;
  avgRoutedCorpusCoverage: number;
  allGoldCorporaPresentCount: number;
  allGoldCorporaPresentPct: number;
}

function corpusCoverageCount(
  chunks: Array<{ corpusId: string }>,
  corpusIds: string[],
): number {
  const represented = new Set(chunks.map((chunk) => chunk.corpusId));
  return corpusIds.filter((corpusId) => represented.has(corpusId)).length;
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2;
  }
  return sorted[mid]!;
}

export function applyFinalValidationFilter(
  reranked: RerankedChunk[],
  routedCorpusIds: string[],
  variant: FinalValidationVariant,
): RerankedChunk[] {
  if (variant === 'A_baseline_0.40') {
    return dynamicContextFilter(reranked, {
      relativeScoreThreshold: DEFAULT_RELATIVE_SCORE_THRESHOLD,
    });
  }

  return dynamicContextFilter(reranked, {
    relativeScoreThreshold: DEFAULT_RELATIVE_SCORE_THRESHOLD,
    routedCorpusIds:
      routedCorpusIds.length > 1 ? routedCorpusIds : undefined,
  });
}

export function buildFilterStageDiagnostics(
  record: QuestionQuotaAuditRecord,
  reranked: RerankedChunk[],
  filtered: RerankedChunk[],
): FilterStageDiagnostics {
  const goldCorpusIds = goldCorpusIdsFromArticles(record.goldArticles);
  const cappedInput = reranked.slice(0, MAX_CONTEXT_CHUNKS);
  const bestScore = cappedInput[0]?.rerankScore ?? 0;
  const keptIds = new Set(filtered.map((chunk) => chunk.chunkId));
  const filterDetails = cappedInput.map((chunk) => ({
    chunkId: chunk.chunkId,
    corpusId: chunk.corpusId,
    articleNumber: chunk.articleNumber,
    rerankScore: chunk.rerankScore ?? 0,
    relativeScore: computeRelativeScore(chunk.rerankScore ?? 0, bestScore),
    kept: keptIds.has(chunk.chunkId),
  }));

  const rerankChunks = record.rerank.map((entry) => ({
    corpusId: entry.corpusId,
    articleNumber: entry.articleNumber,
  }));
  const retrievalChunks = record.retrieval.map((entry) => ({
    corpusId: entry.corpusId,
    articleNumber: entry.articleNumber,
  }));
  const filteredChunks = filtered.map((chunk) => ({
    corpusId: chunk.corpusId,
    articleNumber: chunk.articleNumber,
  }));

  const goldHits = goldArticlesPresent(filtered, record.goldArticles);

  return {
    routedCorpusIds: record.routedCorpusIds,
    goldCorpusIds,
    retrievalRoutedCorpusCount: corpusCoverageCount(
      retrievalChunks,
      record.routedCorpusIds,
    ),
    rerankRoutedCorpusCount: corpusCoverageCount(
      rerankChunks,
      record.routedCorpusIds,
    ),
    filterRoutedCorpusCount: corpusCoverageCount(
      filteredChunks,
      record.routedCorpusIds,
    ),
    retrievalGoldCorpusCount: corpusCoverageCount(retrievalChunks, goldCorpusIds),
    rerankGoldCorpusCount: corpusCoverageCount(rerankChunks, goldCorpusIds),
    filterGoldCorpusCount: corpusCoverageCount(filteredChunks, goldCorpusIds),
    rerankTop5: record.rerank.map((entry) => ({
      rank: entry.rerankRank,
      chunkId: entry.chunkId,
      corpusId: entry.corpusId,
      articleNumber: entry.articleNumber,
      rerankScore: entry.rerankScore,
    })),
    filterDetails,
    chunksBeforeFilter: record.rerank.length,
    chunksAfterFilter: filtered.length,
    removedChunks: filterDetails
      .filter((chunk) => !chunk.kept)
      .map((chunk) => ({
        chunkId: chunk.chunkId,
        corpusId: chunk.corpusId,
        articleNumber: chunk.articleNumber,
        rerankScore: chunk.rerankScore,
        relativeScore: chunk.relativeScore,
      })),
    goldArticlesInContext: goldHits.map(
      (article) => `${article.corpusId}:${article.articleNumber}`,
    ),
    allGoldCorporaPresent:
      goldCorpusIds.length === 2
        ? corpusCoverageCount(filteredChunks, goldCorpusIds) === 2
        : false,
  };
}

export function selectFinalValidationCohort(
  records: QuestionQuotaAuditRecord[],
  options: { minSize?: number; maxSize?: number } = {},
): FinalValidationCohortSelection {
  const minSize = options.minSize ?? 30;
  const maxSize = options.maxSize ?? 40;
  const byId = new Map(records.map((record) => [record.questionId, record]));
  const selected = new Set<string>();
  const rationale: Record<string, string> = {};

  function add(record: QuestionQuotaAuditRecord, reason: string): void {
    if (selected.has(record.questionId) || selected.size >= maxSize) {
      return;
    }
    selected.add(record.questionId);
    rationale[record.questionId] = reason;
  }

  for (const questionId of FINAL_VALIDATION_MANDATORY_IDS) {
    const record = byId.get(questionId);
    if (record) {
      add(record, `mandatory prior benchmark (${record.classification.byRoutedCorpus})`);
    }
  }

  const priorityOrder: Array<'C' | 'B' | 'A'> = ['C', 'B', 'A'];
  for (const className of priorityOrder) {
    for (const record of records) {
      if (selected.size >= maxSize) {
        break;
      }
      if (record.classification.byRoutedCorpus !== className) {
        continue;
      }
      if (selected.has(record.questionId)) {
        continue;
      }
      add(record, `class ${className} fill`);
    }
  }

  for (const record of records) {
    if (selected.size >= maxSize) {
      break;
    }
    add(record, 'representative fill');
  }

  if (selected.size < minSize) {
    throw new Error(
      `Final validation cohort too small: ${selected.size} < ${minSize}`,
    );
  }

  const questionIds = [...selected];
  const composition = { classA: 0, classB: 0, classC: 0, other: 0 };
  for (const questionId of questionIds) {
    const record = byId.get(questionId)!;
    const cls = record.classification.byRoutedCorpus;
    if (cls === 'A') composition.classA += 1;
    else if (cls === 'B') composition.classB += 1;
    else if (cls === 'C') composition.classC += 1;
    else composition.other += 1;
  }

  return { questionIds, rationale, composition };
}

export function aggregateFinalValidationResults(
  results: FinalValidationQuestionResult[],
): FinalValidationAggregateRow[] {
  return FINAL_VALIDATION_VARIANTS.map((variant) => {
    const runs = results.map((result) => result.variants[variant]);
    const judged = runs.filter((run) => run.judge !== undefined);
    const sourceJudged = runs.filter((run) => run.sourceJudge !== undefined);
    const chunkCounts = runs.map((run) => run.contextChunkCount);
    let goldHits = 0;
    let goldTotal = 0;
    let allGoldCorporaPresent = 0;
    let goldCorpusEligible = 0;

    for (const result of results) {
      const run = result.variants[variant];
      goldHits += run.goldArticleHits.length;
      goldTotal += result.goldArticles.length;
      if (result.goldCorpusIds.length === 2) {
        goldCorpusEligible += 1;
        if (run.diagnostics.allGoldCorporaPresent) {
          allGoldCorporaPresent += 1;
        }
      }
    }

    return {
      variant,
      label: FINAL_VALIDATION_LABELS[variant],
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
      avgContextChunks: average(chunkCounts),
      medianContextChunks: median(chunkCounts),
      avgGoldArticleHits: average(runs.map((run) => run.goldArticleHits.length)),
      goldArticleRecall: goldTotal > 0 ? goldHits / goldTotal : 0,
      avgRoutedCorpusCoverage: average(
        runs.map((run) => run.diagnostics.filterRoutedCorpusCount),
      ),
      allGoldCorporaPresentCount: allGoldCorporaPresent,
      allGoldCorporaPresentPct:
        goldCorpusEligible > 0 ? allGoldCorporaPresent / goldCorpusEligible : 0,
    };
  });
}

function formatPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function buildFinalValidationReportMarkdown(input: {
  cohort: FinalValidationCohortSelection;
  aggregates: FinalValidationAggregateRow[];
  results: FinalValidationQuestionResult[];
  auditSourcePath: string;
  generationModel: string;
  judgeModel: string;
}): string {
  const aggA = input.aggregates.find((row) => row.variant === 'A_baseline_0.40')!;
  const aggB = input.aggregates.find(
    (row) => row.variant === 'B_conditional_min1_0.40',
  )!;

  const lines = [
    '# Validation finale - filter conditionnel multicorpus',
    '',
    '## 1. Cohorte exacte',
    '',
    '```text',
    `${input.cohort.questionIds.length} questions`,
    `Class A: ${input.cohort.composition.classA}`,
    `Class B: ${input.cohort.composition.classB}`,
    `Class C: ${input.cohort.composition.classC}`,
    `Other: ${input.cohort.composition.other}`,
    '',
    input.cohort.questionIds.join(', '),
    '```',
    '',
    '| questionId | class | selection |',
    '|------------|-------|-----------|',
  ];

  for (const questionId of input.cohort.questionIds) {
    const result = input.results.find((entry) => entry.questionId === questionId);
    lines.push(
      `| ${questionId} | ${result?.classification.byRoutedCorpus ?? 'n/a'} | ${input.cohort.rationale[questionId] ?? 'n/a'} |`,
    );
  }

  lines.push(
    '',
    '## 2. Methodologie',
    '',
    '- Scores Jina reutilises depuis audit quota (pas de re-rerank).',
    '- Meme routing, retrieval, rerank top-5, generation, judge pour A et B.',
    '- Seul le filter change entre A (0.40) et B (min1/corpus conditionnel @ 0.40 si >1 corpus route).',
    `- Audit source: \`${input.auditSourcePath}\``,
    `- Generation: \`${input.generationModel}\` | Judge: \`${input.judgeModel}\``,
    '',
    '## 3. Tableau comparatif A vs B',
    '',
    '| metrique | A: 0.40 | B: conditional min1 | delta B-A |',
    '|----------|---------|---------------------|-----------|',
  );

  const rows: Array<[string, number, number, (a: number, b: number) => string]> = [
    ['correctness', aggA.avgCorrectness, aggB.avgCorrectness, (a, b) => (b - a).toFixed(2)],
    ['completeness', aggA.avgCompleteness, aggB.avgCompleteness, (a, b) => (b - a).toFixed(2)],
    ['groundedness', aggA.avgGroundedness, aggB.avgGroundedness, (a, b) => (b - a).toFixed(2)],
    ['source relevance', aggA.avgSourceRelevance, aggB.avgSourceRelevance, (a, b) => (b - a).toFixed(2)],
    ['source coverage', aggA.avgSourceCoverage, aggB.avgSourceCoverage, (a, b) => (b - a).toFixed(2)],
    ['avg chunks', aggA.avgContextChunks, aggB.avgContextChunks, (a, b) => (b - a).toFixed(2)],
    ['median chunks', aggA.medianContextChunks, aggB.medianContextChunks, (a, b) => (b - a).toFixed(2)],
    [
      'gold article recall',
      aggA.goldArticleRecall,
      aggB.goldArticleRecall,
      (a, b) => formatPct(b - a),
    ],
    [
      '2 routed corpora in context',
      aggA.avgRoutedCorpusCoverage,
      aggB.avgRoutedCorpusCoverage,
      (a, b) => (b - a).toFixed(2),
    ],
    [
      'all gold corpora present',
      aggA.allGoldCorporaPresentPct,
      aggB.allGoldCorporaPresentPct,
      (a, b) => formatPct(b - a),
    ],
  ];

  for (const [name, a, b, deltaFn] of rows) {
    const aDisplay = name.includes('recall') || name.includes('gold corpora')
      ? formatPct(a)
      : a.toFixed(2);
    const bDisplay = name.includes('recall') || name.includes('gold corpora')
      ? formatPct(b)
      : b.toFixed(2);
    lines.push(`| ${name} | ${aDisplay} | ${bDisplay} | ${deltaFn(a, b)} |`);
  }

  lines.push(
    '',
    `**Critere central:** all gold corpora present = ${aggB.allGoldCorporaPresentCount}/${aggB.questionCount} (B) vs ${aggA.allGoldCorporaPresentCount}/${aggA.questionCount} (A).`,
    '',
    '## 4-5. Metriques judge et couverture',
    '',
    'Voir tableau section 3. Gold article recall et couverture corpus gold sont les indicateurs principaux de couverture multicorpus.',
    '',
    '## 6. Regressions',
    '',
  );

  const regressions = input.results.filter((result) => {
    const a = result.variants['A_baseline_0.40'].judge;
    const b = result.variants['B_conditional_min1_0.40'].judge;
    if (!a || !b) return false;
    const aSum = a.correctness + a.completeness + a.groundedness;
    const bSum = b.correctness + b.completeness + b.groundedness;
    return bSum < aSum - 1;
  });

  if (regressions.length === 0) {
    lines.push('Aucune regression judge majeure (delta sum > 1) detectee pour B vs A.');
  } else {
    for (const result of regressions) {
      const a = result.variants['A_baseline_0.40'].judge!;
      const b = result.variants['B_conditional_min1_0.40'].judge!;
      lines.push(
        `- **${result.questionId}** (${result.classification.byRoutedCorpus}): A=${a.correctness}/${a.completeness}/${a.groundedness} -> B=${b.correctness}/${b.completeness}/${b.groundedness}`,
      );
    }
  }

  const classAStable = input.results
    .filter((r) => r.classification.byRoutedCorpus === 'A')
    .every((r) => {
      const a = r.variants['A_baseline_0.40'].judge!;
      const b = r.variants['B_conditional_min1_0.40'].judge!;
      return b.correctness + b.completeness >= a.correctness + a.completeness - 1;
    });

  lines.push(
    '',
    `Cas class A stables (corr+comp): ${classAStable ? 'oui' : 'non - voir per-question.json'}`,
    '',
    '## 7. Cas representatifs',
    '',
  );

  const examples = [
    { id: 'q353', note: 'C - gold civil restaure par B' },
    { id: 'q374', note: 'B - rerank mono-corpus, filter ne peut pas aider' },
    { id: 'q362', note: 'A - deja bi-corpus @ filter' },
  ];

  for (const example of examples) {
    const result = input.results.find((entry) => entry.questionId === example.id);
    if (!result) continue;
    const a = result.variants['A_baseline_0.40'];
    const b = result.variants['B_conditional_min1_0.40'];
    lines.push(
      `### ${example.id} - ${example.note}`,
      '',
      `- A: chunks=${a.contextChunkCount} corp=${a.diagnostics.filterRoutedCorpusCount}/2 goldCorp=${a.diagnostics.allGoldCorporaPresent} judge=${a.judge?.correctness}/${a.judge?.completeness}/${a.judge?.groundedness}`,
      `- B: chunks=${b.contextChunkCount} corp=${b.diagnostics.filterRoutedCorpusCount}/2 goldCorp=${b.diagnostics.allGoldCorporaPresent} judge=${b.judge?.correctness}/${b.judge?.completeness}/${b.judge?.groundedness}`,
      `- Gold in context A: ${a.goldArticleHits.join(', ') || 'none'}`,
      `- Gold in context B: ${b.goldArticleHits.join(', ') || 'none'}`,
      '',
    );
  }

  const favorable =
    aggB.allGoldCorporaPresentPct > aggA.allGoldCorporaPresentPct + 0.15 &&
    aggB.goldArticleRecall > aggA.goldArticleRecall &&
    aggB.avgCorrectness + aggB.avgCompleteness >=
      aggA.avgCorrectness + aggA.avgCompleteness - 0.2 &&
    aggB.avgGroundedness >= aggA.avgGroundedness - 0.15;

  lines.push(
    '## 8. Decision recommandee',
    '',
  );

  if (favorable) {
    lines.push(
      '**Signal favorable** pour implementer le filter conditionnel multicorpus en production:',
      '',
      `- Couverture corpus gold: ${formatPct(aggA.allGoldCorporaPresentPct)} -> ${formatPct(aggB.allGoldCorporaPresentPct)}`,
      `- Gold article recall: ${formatPct(aggA.goldArticleRecall)} -> ${formatPct(aggB.goldArticleRecall)}`,
      `- Correctness/completeness: stable ou en hausse`,
      `- Chunks: +${(aggB.avgContextChunks - aggA.avgContextChunks).toFixed(2)} en moyenne`,
      '',
      '**Prochaine etape:** implementation production minimale + tests unitaires + E2E 500.',
    );
  } else {
    lines.push(
      '**Signal ambigu ou defavorable** - ne pas modifier le filter production sans analyse supplementaire.',
      '',
      'Presenter les cas contradictoires dans `per-question.json` et ne pas lancer de nouvelles optimisations arbitraires.',
    );
  }

  return `${lines.join('\n')}\n`;
}

export type { JudgeScoreSnapshot, SourceJudgeScoreSnapshot };
