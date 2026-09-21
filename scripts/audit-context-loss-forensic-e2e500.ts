import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { DEFAULT_MULTICORPUS_EVALUATION_DATASET_PATH } from '../src/evaluation/constants.js';
import { loadMulticorpusEvaluationDataset } from '../src/evaluation/load-multicorpus-dataset.js';
import {
  attachPipelineChunks,
  buildContextLossRecord,
  computeContextLossMetrics,
  summarizeContextLoss,
  type ContextLossForensicRecordWithPipeline,
  type ContextLossStageBucket,
} from '../src/evaluation/multicorpus/context-loss-forensic-audit.js';
import type { GenerationForensicRecord } from '../src/evaluation/multicorpus/generation-forensic-audit.js';
import type { QuestionQuotaAuditRecord } from '../src/evaluation/multicorpus/rerank-filter-quota-audit.js';

const E2E_RUN_ID = '2026-09-21T16-59-10-310Z';
const E2E_RUN_DIR = join('reports/evaluation/runs', E2E_RUN_ID);
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
  'context-loss-forensic-audit-2026-09-21',
);

interface QuotaAuditFile {
  metadata: Record<string, unknown>;
  perQuestion: QuestionQuotaAuditRecord[];
}

function stageLabel(stage: ContextLossStageBucket): string {
  const labels: Record<ContextLossStageBucket, string> = {
    retrieval: 'Retrieval',
    reranking: 'Reranking',
    filter: 'Filter',
    mapping: 'Mapping/ambigu',
    indeterminate: 'Indetermine',
  };
  return labels[stage];
}

function buildReportMarkdown(input: {
  records: ContextLossForensicRecordWithPipeline[];
  summary: ReturnType<typeof summarizeContextLoss>;
  e2eRunId: string;
  artefactsNote: string[];
}): string {
  const { records, summary } = input;
  const byStage = summary.byStage;

  const execLines = [
    `${summary.auditedQuestionCount} erreurs de contexte auditees.`,
    '',
    `Retrieval : ${byStage.retrieval.questionsWithLoss} (${byStage.retrieval.goldArticlesLost} articles gold)`,
    `Reranking : ${byStage.reranking.questionsWithLoss} (${byStage.reranking.goldArticlesLost} articles gold)`,
    `Filter : ${byStage.filter.questionsWithLoss} (${byStage.filter.goldArticlesLost} articles gold)`,
    `Mapping/ambiguite : ${byStage.mapping.questionsWithLoss} (${byStage.mapping.goldArticlesLost} articles gold)`,
    `Indetermine : ${byStage.indeterminate.questionsWithLoss} (${byStage.indeterminate.goldArticlesLost} articles gold)`,
  ];

  const tableRows = (
    ['retrieval', 'reranking', 'filter', 'mapping', 'indeterminate'] as const
  ).map(
    (stage) =>
      `| ${stageLabel(stage)} | ${byStage[stage].questionsWithLoss} | ${byStage[stage].goldArticlesLost} |`,
  );

  const singleRecords = records.filter((record) => record.questionType === 'single-corpus');
  const multiRecords = records.filter((record) => record.questionType !== 'single-corpus');

  function splitTable(stage: ContextLossStageBucket): string {
    const bucket = summary.byQuestionType[stage];
    return `| ${stageLabel(stage)} | ${bucket.singleCorpus.questionsWithLoss} | ${bucket.singleCorpus.goldArticlesLost} | ${bucket.multiCorpus.questionsWithLoss} | ${bucket.multiCorpus.goldArticlesLost} |`;
  }

  const examples = records
    .filter((record) => record.stageTraceSource === 'quota-audit-proxy-replay')
    .slice(0, 8);

  const lines = [
    '# Audit forensic ÿ pertes de contexte (E2E 500)',
    '',
    '## Resume executif',
    '',
    '```text',
    ...execLines,
    '```',
    '',
    'Cohorte: **61** erreurs categorie **A ÿ contexte insuffisant** (generation forensic), **hors q372** (vraie generation).',
    '',
    `- Run E2E: \`${input.e2eRunId}\``,
    `- Trace pipeline complete (proxy): **${summary.stageTraceCoverage.fullPipelineProxy}** questions`,
    `- Contexte final seul: **${summary.stageTraceCoverage.finalContextOnly}** questions`,
    '',
    '## 1. Methodologie',
    '',
    '- Cohorte importee depuis `generation-forensic-audit-2026-09-21/per-question.json` (forensicCategory A).',
    '- Sources finales: variante **routing** du run E2E (`e2e.json` / e2e-cache) ÿ `corpusId` + `articleNumber`.',
    '- Run E2E 500 **ne persiste pas** retrieval top20, rerank top5 ni chunks filtres.',
    `- Pour **${summary.stageTraceCoverage.fullPipelineProxy}** questions multicorpus bi-routees: retrieval + rerank depuis \`multicorpus-rerank-filter-audit-quota-2026-09-21T15-22-47-287Z/audit.json\` (proxy offline, meme hyperparametres top20/top5/seuil 0.40).`,
    '- Filter **rejoue** localement via `dynamicContextFilter` production (min1/corpus conditionnel si plusieurs corpus routes).',
    '- Classification par article gold manquant: R0 retrieval, R1 rerank, R2 filter, R3 mapping, R4 indetermine.',
    '- **Aucun** appel OpenAI, Jina, embedding ou relance E2E.',
    '',
    '### Artefacts E2E 500 inspectes',
    '',
    ...input.artefactsNote.map((note) => `- ${note}`),
    '',
    '## 2. Resultat global',
    '',
    '| Etape | Questions avec au moins un gold perdu ici | Gold articles perdus |',
    '|-------|----------------------------------------:|---------------------:|',
    ...tableRows,
    '',
    '### Comptage par raison (articles gold manquants)',
    '',
    '| Raison | Count |',
    '|--------|------:|',
    `| R0 retrieval | ${summary.byReason.R0} |`,
    `| R1 reranking | ${summary.byReason.R1} |`,
    `| R2 filter | ${summary.byReason.R2} |`,
    `| R3 mapping | ${summary.byReason.R3} |`,
    `| R4 indetermine | ${summary.byReason.R4} |`,
    '',
    '## 3. Single-corpus (30 cas)',
    '',
    'Aucun artefact retrieval/rerank dans le run E2E 500 pour ces IDs. Tous les articles gold manquants sont classes **R4** (localisation pipeline impossible).',
    '',
    '| Etape | Questions | Articles gold |',
    '|-------|----------:|--------------:|',
    ...(['retrieval', 'reranking', 'filter', 'mapping', 'indeterminate'] as const).map(
      (stage) => {
        const bucket = summary.byQuestionType[stage].singleCorpus;
        return `| ${stageLabel(stage)} | ${bucket.questionsWithLoss} | ${bucket.goldArticlesLost} |`;
      },
    ),
    '',
    '## 4. Multicorpus (31 cas)',
    '',
    '| Etape | Questions | Articles gold |',
    '|-------|----------:|--------------:|',
    ...(['retrieval', 'reranking', 'filter', 'mapping', 'indeterminate'] as const).map(
      (stage) => {
        const bucket = summary.byQuestionType[stage].multiCorpus;
        return `| ${stageLabel(stage)} | ${bucket.questionsWithLoss} | ${bucket.goldArticlesLost} |`;
      },
    ),
    '',
    '### Single vs multi (tableau combine)',
    '',
    '| Etape | Q single | Gold single | Q multi | Gold multi |',
    '|-------|---------:|------------:|--------:|-----------:|',
    ...(['retrieval', 'reranking', 'filter', 'mapping', 'indeterminate'] as const).map(
      (stage) => splitTable(stage),
    ),
    '',
    'Hypothese multicorpus partiels (29 cas couverture gold partielle): pertes retrieval/rerank/filter observables sur le sous-ensemble proxy **26/31** multicorpus.',
    '',
    '## 5. Patterns',
    '',
    '- **single-corpus-sans-artefacts-pipeline**: 30 questions ÿ zero gold en contexte final, etape amont non mesurable sur E2E 500.',
    '- **multicorpus-gold-absent-retrieval-top20**: articles gold jamais dans le top20 (proxy).',
    '- **multicorpus-gold-perdu-au-rerank-top5**: present en retrieval, absent du top5 Jina (proxy).',
    '- **multicorpus-gold-perdu-au-filter-0.40**: present top5, elimine par seuil relatif 0.40 (replay production min1/corpus).',
    '- **couverture-gold-partielle-sources-finales**: un corpus/article gold present, un autre manquant.',
    '- **meme-corpus-articles-voisins**: contexte du bon corpus mais mauvais numero d article (typique single-corpus).',
    '',
    '## 6. Comparaison audits precedents',
    '',
    '- `multicorpus-rerank-filter-audit-2026-09-20/` et quota 2026-09-21: dominante **rerank** (classe B) puis **filter** (classe C) avant min1/corpus.',
    '- `multicorpus-filter-final-validation-2026-09-21T16-11-25-231Z/`: min1/corpus ameliore la couverture corpus au filter pour le cohort proxy; les pertes restantes sur les 61 erreurs E2E incluent surtout l **indetermine** faute de traces single-corpus.',
    '- min1/corpus ne resout pas les articles gold absents du top5 Jina ni absents du top20 retrieval.',
    '',
    '## 7. Metriques offline',
    '',
    `- Scope: ${summary.offlineMetrics.scope}`,
  ];

  const metrics = summary.offlineMetrics;
  if (metrics.goldArticleRecallAt20Retrieval !== undefined) {
    lines.push(
      `- gold article recall @20 retrieval (proxy ${summary.stageTraceCoverage.fullPipelineProxy} q): **${(metrics.goldArticleRecallAt20Retrieval * 100).toFixed(1)}%**`,
      `- gold article recall @5 rerank: **${(metrics.goldArticleRecallAt5Rerank! * 100).toFixed(1)}%**`,
      `- gold article recall final context (proxy): **${(metrics.goldArticleRecallFinalContext! * 100).toFixed(1)}%**`,
      `- corpus coverage retrieval / rerank / final (proxy): **${(metrics.corpusCoverageRetrieval! * 100).toFixed(1)}%** / **${(metrics.corpusCoverageRerank! * 100).toFixed(1)}%** / **${(metrics.corpusCoverageFinal! * 100).toFixed(1)}%**`,
    );
  } else {
    lines.push('- Recall @20/@5: **non calculable avec les artefacts du run E2E 500 seul.**');
  }
  if (metrics.note) {
    lines.push(`- ${metrics.note}`);
  }

  lines.push('', '## 8. Exemples representatifs', '');

  for (const example of examples) {
    const retrievalSummary = example.pipelineRetrieval
      ? example.pipelineRetrieval
          .slice(0, 5)
          .map(
            (chunk) =>
              `${chunk.corpusId}:${chunk.articleNumber}@r${chunk.retrievalRank}`,
          )
          .join(', ')
      : 'n/a';
    const rerankSummary = example.pipelineRerank
      ? example.pipelineRerank
          .map(
            (chunk) =>
              `${chunk.corpusId}:${chunk.articleNumber}@r${chunk.rerankRank}`,
          )
          .join(', ')
      : 'n/a';
    const lossSummary = example.goldArticleLosses
      .map(
        (loss) =>
          `${loss.gold.corpusId}:${loss.gold.articleNumber}?${loss.reason}`,
      )
      .join('; ');

    lines.push(
      `### ${example.questionId}`,
      '',
      `**Question:** ${example.question}`,
      '',
      `**Gold:** ${example.goldArticles.map((article) => `${article.corpusId}:${article.articleNumber}`).join(', ')}`,
      '',
      `**Routed:** ${example.routedCorpusIds.join(', ')}`,
      '',
      `**Retrieval (top5):** ${retrievalSummary}`,
      '',
      `**Reranking (top5):** ${rerankSummary}`,
      '',
      `**Contexte final:** ${example.contextSources.map((source) => `${source.corpusId}:${source.articleNumber}`).join(', ') || 'none'}`,
      '',
      `**Pertes:** ${lossSummary}`,
      '',
      `**Cause primaire:** ${stageLabel(example.primaryLossStage)} (${example.stageTraceSource})`,
      '',
    );
  }

  const proxyLosses = records.filter(
    (record) => record.stageTraceSource === 'quota-audit-proxy-replay',
  );
  const r0r1 = summary.byReason.R0 + summary.byReason.R1;
  const r2 = summary.byReason.R2;
  const r4single = singleRecords.length;
  const proxyMeasurable = summary.byReason.R0 + summary.byReason.R1 + summary.byReason.R2;

  lines.push(
    '## 9. Conclusion',
    '',
    `Le principal goulot **sur les traces disponibles** est le **retrieval**: **${summary.byReason.R0}/${proxyMeasurable}** articles gold manquants localises (proxy 26 q) sont absents du top20 avant rerank/filter.`,
    '',
    `- Reranking (R1): **${summary.byReason.R1}** articles gold.`,
    `- Filter replay production min1/corpus @ 0.40 (R2): **${r2}** articles gold.`,
    `- **${r4single}** questions single-corpus + **5** multicorpus hors proxy: **${byStage.indeterminate.goldArticlesLost}** articles en **R4** (non calculable sur E2E 500 seul).`,
    '',
    r0r1 > r2
      ? `- Sur le sous-ensemble mesurable, retrieval (+ rerank marginale) domine; le filter n explique que **${r2}** pertes apres min1/corpus.`
      : '- Le filter reste un contributeur majeur sur le sous-ensemble mesurable.',
    '',
    '- Prochain benchmark recommande (sans modifier la production): E2E ou replay **avec persistance retrieval top20 + rerank top5** pour les **30 single-corpus**; conserver le cohort multicorpus proxy pour comparer rerank vs retrieval.',
    '',
  );

  void proxyLosses;
  return `${lines.join('\n')}\n`;
}

async function main(): Promise<void> {
  const [genForensicRaw, quotaRaw, datasetQuestions] = await Promise.all([
    readFile(join(GEN_FORENSIC_DIR, 'audit.json'), 'utf-8'),
    readFile(QUOTA_AUDIT_PATH, 'utf-8'),
    loadMulticorpusEvaluationDataset(DEFAULT_MULTICORPUS_EVALUATION_DATASET_PATH),
  ]);

  const genForensic = JSON.parse(genForensicRaw) as {
    records: GenerationForensicRecord[];
  };
  const quotaAudit = JSON.parse(quotaRaw) as QuotaAuditFile;
  const quotaById = new Map(
    quotaAudit.perQuestion.map((record) => [record.questionId, record]),
  );

  const cohort = genForensic.records.filter(
    (record) => record.forensicCategory === 'A' && record.questionId !== 'q372',
  );

  if (cohort.length !== 61) {
    throw new Error(`Expected 61 category-A records, got ${cohort.length}`);
  }

  const records: ContextLossForensicRecordWithPipeline[] = [];

  for (const forensic of cohort) {
    const quotaRecord = quotaById.get(forensic.questionId);
    const routedCorpusIds =
      quotaRecord?.routedCorpusIds ?? [...forensic.goldCorpusIds].sort();

    let record = buildContextLossRecord({
      forensic,
      routedCorpusIds,
      quotaRecord,
    });

    if (quotaRecord) {
      record = attachPipelineChunks(record, quotaRecord);
    }

    records.push(record);
  }

  const metrics = computeContextLossMetrics(records);
  const summary = summarizeContextLoss(records, metrics);

  const auditPayload = {
    metadata: {
      e2eRunId: E2E_RUN_ID,
      e2eRunDir: E2E_RUN_DIR,
      generationForensicDir: GEN_FORENSIC_DIR,
      quotaAuditProxy: QUOTA_AUDIT_PATH,
      timestamp: new Date().toISOString(),
      methodology: 'Read-only context-loss localization from E2E final sources + quota audit proxy.',
      constraints: [
        'No production code changes',
        'No LLM/Jina/embedding calls',
        'No E2E re-run',
      ],
      e2eArtefactsPresent: ['e2e.json', 'e2e-cache/', 'report.json', 'report.md'],
      e2eArtefactsMissing: [
        'routing.json per question',
        'retrieval top20 lists',
        'rerank top5 lists',
        'filtered chunk lists in E2E output',
      ],
    },
    summary,
    records,
  };

  const artefactsNote = [
    'Present: `e2e.json`, `report.json`, `e2e-cache/*.json` (sources finales, judge, profiling counts).',
    'Absent: listes retrieval/rerank/filter par question dans le run E2E 500.',
    `Proxy: \`multicorpus-rerank-filter-audit-quota-2026-09-21T15-22-47-287Z/audit.json\` (${summary.stageTraceCoverage.fullPipelineProxy} questions overlap).`,
  ];

  const reportMarkdown = buildReportMarkdown({
    records,
    summary,
    e2eRunId: E2E_RUN_ID,
    artefactsNote,
  });

  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(join(OUTPUT_DIR, 'audit.json'), `${JSON.stringify(auditPayload, null, 2)}\n`);
  await writeFile(
    join(OUTPUT_DIR, 'per-question.json'),
    `${JSON.stringify(records, null, 2)}\n`,
  );
  await writeFile(join(OUTPUT_DIR, 'REPORT.md'), reportMarkdown);

  console.log(`Context-loss forensic audit: ${records.length} questions`);
  console.log(JSON.stringify(summary.byStage, null, 2));
  console.log(`Output: ${OUTPUT_DIR}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
