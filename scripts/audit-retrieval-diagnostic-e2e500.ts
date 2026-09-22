import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  buildGoldLossDiagnostics,
  pickRepresentativeExamples,
  RETRIEVAL_ARCHITECTURE_FACTS,
  summarizeCauseMatrix,
  summarizeCompetitorPatterns,
  type GoldLossDiagnostic,
} from '../src/evaluation/multicorpus/retrieval-diagnostic.js';

const OUTPUT_DIR = join(
  'reports/evaluation/runs',
  'retrieval-diagnostic-2026-09-21',
);
const CONTEXT_LOSS_AUDIT = join(
  'reports/evaluation/runs',
  'context-loss-forensic-audit-2026-09-21',
  'audit.json',
);

function buildReport(input: {
  diagnostics: GoldLossDiagnostic[];
  causeMatrix: ReturnType<typeof summarizeCauseMatrix>;
  competitorPatterns: ReturnType<typeof summarizeCompetitorPatterns>;
  observable: {
    pipelineTraceQuestions: number;
    indeterminateGoldArticles: number;
    cohortGoldLosses: number;
  };
}): string {
  const semantic = input.causeMatrix.find((row) => row.category === 'semantic_mismatch')
    ?.count ?? 0;
  const multi = input.causeMatrix.find(
    (row) => row.category === 'multicorpus_competition',
  )?.count ?? 0;
  const rerank = input.causeMatrix.find((row) => row.category === 'reranking')?.count ?? 0;
  const filter = input.causeMatrix.find((row) => row.category === 'filter')?.count ?? 0;
  const r0 = input.diagnostics.filter((d) => d.pipelineStage === 'R0').length;

  const lines = [
    '# Diagnostic retrieval � preparation prochaine amelioration RAG',
    '',
    '## 1. Executive summary',
    '',
    'Le retrieval rate certains articles gold surtout parce que le **top20 quota** ramene des **articles voisins du bon corpus** (meme famille L123, 222-x, etc.) ou des passages **juridiquement proches mais incorrects**, plutot que l article gold exact. Sur les traces disponibles (26 questions multicorpus, proxy quota audit), **24/28** pertes localisees sont des **absences retrieval top20 (R0)** ; **2** sont du reranking (R1) et **2** du filter (R2).',
    '',
    `Les **${input.observable.indeterminateGoldArticles}** articles sans trace pipeline (30 single-corpus + 5 multi) restent **indetermines**. On ne peut pas trancher profondeur topK vs embedding sans listes retrieval >20 (deja confirme par retrieval-depth-benchmark).`,
    '',
    '**Prochaine experience principale:** replay offline topK 30/50 avec cache embeddings deja exporte + persistance des listes (pas de nouveau E2E 500) pour separer profondeur insuffisante vs mauvais ranking vectoriel intrinseque.',
    '',
    '## 2. Architecture actuelle',
    '',
    '### Embedding query',
    '',
    `- Texte embedde: ${RETRIEVAL_ARCHITECTURE_FACTS.embeddingInput}`,
    `- Modele: env \`${RETRIEVAL_ARCHITECTURE_FACTS.embeddingModelConfigKey}\` (E2E: text-embedding-3-large)`,
    `- Dimensions: ${RETRIEVAL_ARCHITECTURE_FACTS.embeddingDimensions}`,
    '',
    '### Recherche SQL (pgvector)',
    '',
    `- Table: \`${RETRIEVAL_ARCHITECTURE_FACTS.table}\``,
    `- Distance: ${RETRIEVAL_ARCHITECTURE_FACTS.distanceMetric}`,
    `- Tri: ${RETRIEVAL_ARCHITECTURE_FACTS.ordering}`,
    `- Single-corpus: ${RETRIEVAL_ARCHITECTURE_FACTS.singleCorpusSearch}`,
    `- Multi-corpus (routing): ${RETRIEVAL_ARCHITECTURE_FACTS.multiCorpusSearch}`,
    '',
    '### Champs retournes',
    '',
    ...RETRIEVAL_ARCHITECTURE_FACTS.returnedFields.map((field) => `- ${field}`),
    '',
    '### Chunking (ingestion)',
    '',
    '- TARGET_SIZE=1500 chars, MAX_SIZE=2000, decoupe par unites juridiques puis phrases / hard split.',
    `- chunkId: \`${RETRIEVAL_ARCHITECTURE_FACTS.chunkIdFormat}\``,
    '',
    '## 3. Donnees observables',
    '',
    '| Source | Contenu | Limite |',
    '|--------|---------|--------|',
    '| E2E 500 | sources finales, judge, profiling | pas de top20/top5 persistes |',
    '| context-loss-forensic | 61 cas A, stages R0-R4 | 26 q avec pipeline proxy |',
    '| quota audit 2026-09-21 | retrieval top20 + rerank top5 | pas meme run E2E, 41 q dont 26 overlap |',
    '| retrieval-depth-benchmark | recall @20 = 53.8% (26 q) | @30+ non calculable sans replay |',
    '| data/processed/*.chunks.json | texte/stats chunking gold | pas de scores vectoriels |',
    '',
    `- Questions avec trace retrieval+rerank: **${input.observable.pipelineTraceQuestions}**`,
    `- Articles gold manquants analyses: **${input.observable.cohortGoldLosses}**`,
    `- Indetermines (R4): **${input.observable.indeterminateGoldArticles}**`,
    '',
    '## 4. Analyse des cas',
    '',
    `- **R0 retrieval (top20):** ${r0} articles � voir patterns concurrents ci-dessous.`,
    `- **R1 reranking:** ${rerank} articles � gold present dans retrieval top20 mais absent du top5 Jina.`,
    `- **R2 filter:** ${filter} articles � present top5, elimine par seuil 0.40 (replay min1/corpus).`,
    '',
    'Patterns concurrents (R0 uniquement):',
    '',
    '| Pattern | Count |',
    '|---------|------:|',
  ];

  for (const [pattern, count] of Object.entries(input.competitorPatterns)) {
    if (pattern === 'not_applicable') {
      continue;
    }
    lines.push(`| ${pattern} | ${count} |`);
  }

  lines.push(
    '',
    'Lecture: la majorite des R0 montrent le **bon corpus** avec des **articles alternatifs** (ex. q352: L123-3/L123-5-1 au lieu de L123-8).',
    '',
    '## 5. Classification des causes',
    '',
    '| Cause | Nombre |',
    '|-------|------:|',
  );

  for (const row of input.causeMatrix) {
    lines.push(`| ${row.label} | ${row.count} |`);
  }

  lines.push(
    '',
    '## 6. Hypotheses',
    '',
    '| Hypothese | Statut |',
    '|-----------|--------|',
    '| H1 Profondeur topK (gold en rang 21-50) | **Non demontree** (pas de top>20) |',
    `| H2 Mauvais matching semantique query/chunk | **Fortement supportee** (${semantic} articles classes, R0 avec voisins meme corpus) |`,
    '| H3 Chunking defavorable | **Plausible** (signaux multi-chunk sur subset) |',
    `| H4 Reranking Jina | **Supportee** (${rerank} cas R1) |`,
    `| H5 Filter | **Supportee** (${filter} cas R2, marginal post min1/corpus) |`,
    `| H6 Competition multicorpus quota | **Plausible** (${multi} cas corpus gold absent du top20) |`,
    '',
    '## 7. Prochaine experience recommandee',
    '',
    '**Experience unique:** replay retrieval **topK 30 et 50** (quota + global) sur les **61** questions cohorte A, avec **1 embedding/question deja en cache** + SQL Postgres, sans Jina/generation/judge.',
    '',
    '- **Hypothese:** une part des 24 R0 est due a la profondeur top20; le reste confirmera un plafond semantique.',
    '- **Protocole:** utiliser `export:retrieval-depth-embedding-cache-e2e500` (one-shot) puis `audit:retrieval-depth-e2e500`; persister listes completes.',
    '- **Metrique:** gain recall @30/@50 vs @20; buckets P20-30 / P30-40 / P40-50 / P50+ sur les 24 absents @20.',
    '- **Cout:** ~61 embeddings (deja prevu) + SQL local; pas d E2E 500.',
    '- **Positif:** recall @30 >> @20 ? tester retrievalTopK 30 en smoke cible avant prod.',
    '- **Negatif:** recall @50 proche de @20 -> prioriser query/hybrid retrieval ou reranking, pas topK.',
    '',
    '## 8. Ce qu on NE doit PAS modifier maintenant',
    '',
    '- Routing V3.1 (gele)',
    '- Quota multicorpus 10+10 @20',
    '- Dynamic filter min1/corpus @0.40',
    '- Generation / prompts / modeles',
    '',
    '## 9. Exemples representatifs',
    '',
  );

  for (const example of pickRepresentativeExamples(input.diagnostics, 10)) {
    lines.push(
      `### ${example.questionId} � ${example.gold.corpusId}:${example.gold.articleNumber}`,
      '',
      `**Stage:** ${example.pipelineStage} | **Cause:** ${example.causeCategory}`,
      '',
      `**Question (extrait):** ${example.question.slice(0, 200)}�`,
      '',
      `**Top retrieval:** ${example.competitor.retrievalTopArticles.join(', ') || 'n/a'}`,
      '',
      `**Alternatives meme corpus:** ${example.competitor.sameCorpusAlternatives.join(', ') || 'none'}`,
      '',
      `**Pattern:** ${example.competitor.pattern}`,
      '',
      `**Chunking:** ${example.chunkingSignals.join(', ') || 'n/a'}`,
      '',
    );
  }

  void semantic;
  void multi;
  return `${lines.join('\n')}\n`;
}

async function main(): Promise<void> {
  const auditRaw = await readFile(CONTEXT_LOSS_AUDIT, 'utf-8');
  const audit = JSON.parse(auditRaw) as {
    records: Array<{
      questionId: string;
      question: string;
      routedCorpusIds: string[];
      goldArticleLosses: Array<{ gold: { corpusId: string; articleNumber: string }; reason: string }>;
      pipelineRetrieval?: unknown[];
      pipelineRerank?: unknown[];
    }>;
  };

  const diagnostics = await buildGoldLossDiagnostics(
    audit.records as Parameters<typeof buildGoldLossDiagnostics>[0],
  );

  const causeMatrix = summarizeCauseMatrix(diagnostics);
  const competitorPatterns = summarizeCompetitorPatterns(diagnostics);

  const pipelineTraceQuestions = audit.records.filter(
    (record) => record.pipelineRetrieval && record.pipelineRerank,
  ).length;
  const indeterminateGoldArticles = diagnostics.filter(
    (d) => d.pipelineStage === 'R4',
  ).length;

  const payload = {
    metadata: {
      timestamp: new Date().toISOString(),
      sources: [
        CONTEXT_LOSS_AUDIT,
        'multicorpus-rerank-filter-audit-quota-2026-09-21T15-22-47-287Z/audit.json',
        'retrieval-depth-benchmark-2026-09-21/benchmark.json',
        'data/processed/*.chunks.json',
      ],
      constraints: ['No API', 'No E2E 500', 'No production changes'],
    },
    architecture: RETRIEVAL_ARCHITECTURE_FACTS,
    observable: {
      pipelineTraceQuestions,
      cohortQuestions: audit.records.length,
      cohortGoldLossArticles: diagnostics.length,
      indeterminateGoldArticles,
    },
    causeMatrix,
    competitorPatterns,
    diagnostics,
  };

  const report = buildReport({
    diagnostics,
    causeMatrix,
    competitorPatterns,
    observable: {
      pipelineTraceQuestions,
      indeterminateGoldArticles,
      cohortGoldLosses: diagnostics.length,
    },
  });

  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(join(OUTPUT_DIR, 'diagnostic.json'), `${JSON.stringify(payload, null, 2)}\n`);
  await writeFile(join(OUTPUT_DIR, 'REPORT.md'), report);

  console.log('Retrieval diagnostic complete');
  console.log(JSON.stringify(causeMatrix, null, 2));
  console.log(`Output: ${OUTPUT_DIR}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
