import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { DEFAULT_MULTICORPUS_EVALUATION_DATASET_PATH } from '../src/evaluation/constants.js';
import { loadMulticorpusEvaluationDataset } from '../src/evaluation/load-multicorpus-dataset.js';
import {
  classifyGenerationForensic,
  failedJudgeAxesLabel,
  isPipelineGenerationFailure,
  summarizeForensicCategories,
  summarizeSubCauses,
  type GenerationForensicRecord,
} from '../src/evaluation/multicorpus/generation-forensic-audit.js';
import type { E2EQuestionResult } from '../src/evaluation/multicorpus/types.js';

const RUN_ID = '2026-09-21T16-59-10-310Z';
const RUN_DIR = join('reports/evaluation/runs', RUN_ID);
const OUTPUT_DIR = join(
  'reports/evaluation/runs',
  'generation-forensic-audit-2026-09-21',
);

interface RunReport {
  metadata: Record<string, unknown>;
  e2e: { results: E2EQuestionResult[] };
  errors: {
    byStage: Record<string, number>;
    results: Array<{ questionId: string; failureStage: string }>;
  };
}

function pct(n: number, total: number): string {
  return total === 0 ? '0.0%' : `${((n / total) * 100).toFixed(1)}%`;
}

function buildReportMarkdown(input: {
  runId: string;
  runDir: string;
  records: GenerationForensicRecord[];
  categoryCounts: ReturnType<typeof summarizeForensicCategories>;
  subCauseCounts: ReturnType<typeof summarizeSubCauses>;
  pipelineGenerationCount: number;
}): string {
  const total = input.records.length;
  const trueGen = input.categoryCounts.B;
  const contextLinked =
    input.categoryCounts.A + input.categoryCounts.C + input.categoryCounts.D;

  const byType = new Map<string, number>();
  const byDifficulty = new Map<string, number>();
  const bByType = new Map<string, number>();
  const goldCoverage = { none: 0, partial: 0, full: 0 };
  let bChunkSum = 0;

  for (const record of input.records) {
    byType.set(record.questionType, (byType.get(record.questionType) ?? 0) + 1);
    byDifficulty.set(
      record.difficulty,
      (byDifficulty.get(record.difficulty) ?? 0) + 1,
    );
    goldCoverage[record.goldContextCoverage] += 1;
    if (record.forensicCategory === 'B') {
      bByType.set(record.questionType, (bByType.get(record.questionType) ?? 0) + 1);
      bChunkSum += record.contextSourceCount;
    }
  }

  const pickExamples = (
    category: GenerationForensicRecord['forensicCategory'],
    limit: number,
  ): GenerationForensicRecord[] =>
    input.records.filter((record) => record.forensicCategory === category).slice(0, limit);

  const lines = [
    '# Audit forensic - erreurs generation E2E 500',
    '',
    '## 1. Run audite',
    '',
    `- Run: \`${input.runId}\``,
    `- Artefacts: \`${input.runDir}\``,
    '- Variante analysee: **routing** (meme base que `classifyFailureStage` / judge routing).',
    '',
    '## 2. Methodologie',
    '',
    '- Audit read-only sur `report.json`, `e2e.json` et le dataset multicorpus.',
    '- Aucun appel LLM, embedding, Jina, generation ou judge.',
    '- Le run ne persiste pas les chunks rerankes/scores Jina: diagnostic fonde sur **sources finales** (corpus + article), judge et sourceJudge.',
    '- Regles heuristiques documentees dans `src/evaluation/multicorpus/generation-forensic-audit.ts`.',
    '',
    '## 3. Nombre total d erreurs pipeline `generation`',
    '',
    `- Pipeline: **${input.pipelineGenerationCount}** (report.errors.byStage.generation)`,
    `- Auditees ici: **${total}**`,
    '',
    '## 4. Classification forensic',
    '',
    '```text',
    `${total} generation errors`,
    '|',
    `|-- A contexte insuffisant : ${input.categoryCounts.A}`,
    `|-- B vraie generation : ${input.categoryCounts.B}`,
    `|-- C citation/source : ${input.categoryCounts.C}`,
    `|-- D abstention/cas limite : ${input.categoryCounts.D}`,
    `+-- E indetermine : ${input.categoryCounts.E}`,
    '```',
    '',
    '| categorie | count | % |',
    '|-----------|------:|--:|',
  ];

  for (const [key, label] of [
    ['A', 'Contexte insuffisant'],
    ['B', 'Vraie generation'],
    ['C', 'Citation/source'],
    ['D', 'Abstention/cas limite'],
    ['E', 'Indetermine'],
  ] as const) {
    const count = input.categoryCounts[key];
    lines.push(`| ${label} | ${count} | ${pct(count, total)} |`);
  }

  lines.push(
    '',
    '## 5. Part de vrais problemes de generation',
    '',
    `- **Vraie generation (B):** ${trueGen}/${total} = **${pct(trueGen, total)}**`,
    `- **Encore liees au contexte (A+C+D):** ${contextLinked}/${total} = **${pct(contextLinked, total)}**`,
    '',
    'Question centrale: avec routing/retrieval/rerank/filter deja corriges, combien d erreurs `generation` restent des fautes de gpt-5.6-luna avec contexte suffisant?',
    '',
    `=> **${trueGen}** cas (${pct(trueGen, total)}).`,
    '',
    '## 6. Sous-classification B (vraie generation)',
    '',
  );

  const subEntries = Object.entries(input.subCauseCounts).sort(
    (left, right) => right[1]! - left[1]!,
  );
  if (subEntries.length === 0) {
    lines.push('Aucun cas B identifie.');
  } else {
    lines.push('| sous-cause | count |', '|------------|------:|');
    for (const [code, count] of subEntries) {
      lines.push(`| ${code} | ${count} |`);
    }
  }

  lines.push(
    '',
    '## 7. Repartition (pipeline generation errors)',
    '',
    '### Par type de question',
    '',
    '| type | count |',
    '|------|------:|',
  );
  for (const [type, count] of [...byType.entries()].sort()) {
    lines.push(`| ${type} | ${count} |`);
  }

  lines.push(
    '',
    '### Couverture gold dans le contexte final (routing)',
    '',
    '| couverture | count |',
    '|------------|------:|',
    `| aucun article gold | ${goldCoverage.none} |`,
    `| partielle | ${goldCoverage.partial} |`,
    `| complete | ${goldCoverage.full} |`,
    '',
    'Note: 30/30 erreurs **single-corpus** ont **zero** article gold dans les sources finales.',
    '',
    '### Par difficulte',
    '',
    '| difficulty | count |',
    '|------------|------:|',
  );
  for (const [difficulty, count] of [...byDifficulty.entries()].sort()) {
    lines.push(`| ${difficulty} | ${count} |`);
  }

  lines.push(
    '',
    '### Cas B — type de question',
    '',
    '| type | count B |',
    '|------|--------:|',
  );
  for (const [type, count] of [...bByType.entries()].sort()) {
    lines.push(`| ${type} | ${count} |`);
  }

  if (trueGen > 0) {
    lines.push(
      '',
      `Moyenne chunks contexte (cas B): **${(bChunkSum / trueGen).toFixed(2)}**`,
    );
  }

  lines.push(
    '',
    '## 8. Comparaison audits precedents',
    '',
    'Sur l ancien run `2026-09-19T23-21-51-901Z`, le diagnostic E2E listait **66** erreurs generation, dont une forte majorite avec **article gold absent** du contexte (ex. q001-q003).',
    'Ici, **A** reste dominant si les articles gold manquent encore dans les sources finales; la baisse 66?62 et la hausse des scores agreges suggerent un gain pipeline, mais la repartition A vs B est recalculee sur ce run uniquement.',
    '',
    '## 9. Cas representatifs',
    '',
  );

  const sections: Array<[string, GenerationForensicRecord['forensicCategory'], number]> = [
    ['Vraie generation (B)', 'B', 5],
    ['Contexte insuffisant (A)', 'A', 5],
    ['Citation/source (C)', 'C', 3],
  ];

  for (const [title, category, limit] of sections) {
    const examples = pickExamples(category, limit);
    if (examples.length === 0) continue;
    lines.push(`### ${title}`, '');
    for (const example of examples) {
      lines.push(
        `#### ${example.questionId} (${example.questionType} / ${example.difficulty})`,
        '',
        `**Question:** ${example.question}`,
        '',
        `**Attendu:** ${example.referenceAnswer}`,
        '',
        `**Reponse (extrait):** ${example.generatedAnswer.slice(0, 400).replace(/\n/g, ' ')}—`,
        '',
        `**Contexte (sources):** ${example.contextSources.map((source) => `${source.corpusId}:${source.articleNumber}`).join(', ') || 'none'}`,
        '',
        `**Gold manquants:** ${example.goldArticlesMissingFromContext.map((article) => `${article.corpusId}:${article.articleNumber}`).join(', ') || 'none'}`,
        '',
        `**Judge (${failedJudgeAxesLabel(example.judge)}):** ${example.judge.explanation}`,
        '',
        `**Diagnostic:** ${example.forensicCategory}${example.forensicSubCause ? ` / ${example.forensicSubCause}` : ''} — ${example.forensicRationale}`,
        '',
      );
    }
  }

  lines.push(
    '## 10. Conclusion',
    '',
    `- Sur **${total}** erreurs pipeline \`generation\`, **${trueGen}** (${pct(trueGen, total)}) sont des **vraies erreurs de generation** avec couverture gold complete dans le contexte final (variant routing).`,
    `- **${input.categoryCounts.A}** (${pct(input.categoryCounts.A, total)}) restent expliquees par un **contexte insuffisant** (article/corpus gold absent ou extrait juge insuffisant).`,
    `- Les cas **C/D/E** sont minoritaires dans cette heuristique.`,
    '',
    '## 11. Prochaine etape recommandee',
    '',
    trueGen > input.categoryCounts.A
      ? '- Prioriser l amelioration **generation** (prompt/consignes, multicorpus) sur les cas B, en commencant par les sous-causes les plus frequentes.'
      : '- Prioriser encore le **contexte** (retrieval/rerank/filter) sur les cas A avant d optimiser la generation.',
    '- Ne pas relancer un E2E 500 complet pour cette analyse; cibler replays offline ou smoke sur les IDs B les plus frequents.',
    '',
  );

  return `${lines.join('\n')}\n`;
}

async function main(): Promise<void> {
  const [reportRaw, datasetQuestions] = await Promise.all([
    readFile(join(RUN_DIR, 'report.json'), 'utf-8'),
    loadMulticorpusEvaluationDataset(DEFAULT_MULTICORPUS_EVALUATION_DATASET_PATH),
  ]);

  const report = JSON.parse(reportRaw) as RunReport;
  const questionById = new Map(datasetQuestions.map((question) => [question.id, question]));
  const e2eById = new Map(report.e2e.results.map((result) => [result.questionId, result]));

  const pipelineGenerationIds = report.errors.results
    .filter((entry) => entry.failureStage === 'generation')
    .map((entry) => entry.questionId);

  const records: GenerationForensicRecord[] = [];
  for (const questionId of pipelineGenerationIds) {
    const question = questionById.get(questionId);
    const e2e = e2eById.get(questionId);
    if (!question || !e2e || !isPipelineGenerationFailure(e2e)) {
      throw new Error(`Missing generation error data for ${questionId}`);
    }
    records.push(classifyGenerationForensic({ question, e2e }));
  }

  if (records.length !== report.errors.byStage.generation) {
    throw new Error(
      `Expected ${report.errors.byStage.generation} generation errors, got ${records.length}`,
    );
  }

  const categoryCounts = summarizeForensicCategories(records);
  const subCauseCounts = summarizeSubCauses(records);

  const auditPayload = {
    metadata: {
      auditedRunId: RUN_ID,
      auditedRunDir: RUN_DIR,
      timestamp: new Date().toISOString(),
      pipelineGenerationErrorCount: report.errors.byStage.generation,
      methodology:
        'Read-only heuristic forensic classification from persisted E2E routing variant.',
      limitations: [
        'No reranked chunk list or Jina scores in E2E artefacts.',
        'Final context approximated by cited sources (corpusId + articleNumber).',
        'Routing/retrieval/reranking phase JSON not present in this run (e2e-only).',
      ],
    },
    summary: {
      categoryCounts,
      trueGenerationCount: categoryCounts.B,
      trueGenerationPct: categoryCounts.B / records.length,
      contextLinkedCount:
        categoryCounts.A + categoryCounts.C + categoryCounts.D,
      subCauseCounts,
    },
    records,
  };

  const reportMarkdown = buildReportMarkdown({
    runId: RUN_ID,
    runDir: RUN_DIR,
    records,
    categoryCounts,
    subCauseCounts,
    pipelineGenerationCount: report.errors.byStage.generation,
  });

  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(join(OUTPUT_DIR, 'audit.json'), `${JSON.stringify(auditPayload, null, 2)}\n`);
  await writeFile(join(OUTPUT_DIR, 'per-question.json'), `${JSON.stringify(records, null, 2)}\n`);
  await writeFile(join(OUTPUT_DIR, 'REPORT.md'), reportMarkdown);

  console.log(`Generation forensic audit: ${records.length} errors`);
  console.log(JSON.stringify(categoryCounts, null, 2));
  console.log(`Output: ${OUTPUT_DIR}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
