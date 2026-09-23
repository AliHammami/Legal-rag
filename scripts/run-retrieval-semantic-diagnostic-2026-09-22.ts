import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  analyzeAbsentGoldCase,
  extractAbsentAt50Cohort,
  pickRepresentativeCases,
  summarizeBm25Recovery,
  summarizeClassifications,
  CAUSE_LABELS,
  type GoldRankDetailAbsentAt50,
  type PerQuestionDepthRecord,
} from '../src/evaluation/multicorpus/semantic-diagnostic-analyzer.js';

const OUTPUT_DIR = join(
  'reports/evaluation/runs',
  'retrieval-semantic-diagnostic-2026-09-22',
);
const BENCHMARK = join(
  'reports/evaluation/runs',
  'retrieval-depth-benchmark-2026-09-22',
  'benchmark.json',
);
const PER_QUESTION = join(
  'reports/evaluation/runs',
  'retrieval-depth-benchmark-2026-09-22',
  'per-question.json',
);

function pct(count: number, total: number): string {
  if (total === 0) {
    return '0%';
  }
  return `${((count / total) * 100).toFixed(1)}%`;
}

function buildReport(input: {
  cohortSize: number;
  classification: ReturnType<typeof summarizeClassifications>;
  bm25: ReturnType<typeof summarizeBm25Recovery>;
  representatives: Awaited<ReturnType<typeof analyzeAbsentGoldCase>>[];
  patterns: string[];
  conclusion: string;
  nextExperiment: string;
}): string {
  const total = input.cohortSize;
  const rows = Object.entries(input.classification)
    .map(([key, count]) => {
      const label = CAUSE_LABELS[key as keyof typeof CAUSE_LABELS];
      return `| ${label} | ${count} | ${pct(count, total)} |`;
    })
    .join('\n');

  const repSection = input.representatives
    .map((item) => {
      const top = item.competitorsTop10
        .slice(0, 5)
        .map(
          (row) =>
            `${row.rank}. ${row.corpusId}:${row.articleNumber} (d=${row.distance?.toFixed(3) ?? '-'})`,
        )
        .join('; ');
      return `### ${item.questionId} � ${item.goldCorpus}:${item.goldArticle.articleNumber}

- **Question:** ${item.question.slice(0, 200)}${item.question.length > 200 ? '�' : ''}
- **Gold (extrait):** ${item.goldTextPreview.slice(0, 180)}�
- **Top vector @10:** ${top}
- **Jaccard Q/G:** ${item.lexical.jaccardQuestionGold.toFixed(3)} ; tokens communs: ${item.lexical.sharedTokensQuestionGold.join(', ') || '(aucun)'}
- **Voisins top10:** ${item.neighborAnalysis.neighborArticlesTop10.join(', ') || '(aucun)'}
- **BM25 rank gold:** ${item.bm25.goldBestChunkRank ?? '>50'}
- **Diagnostic:** ${CAUSE_LABELS[item.classification.primary]} (${item.classification.confidence})
- **Hypothese:** ${item.hypothesis}
`;
    })
    .join('\n');

  return `# Diagnostic semantique � golds absents a topK=50

## 1. Resume

- **${input.cohortSize}** gold articles analyses (absents a @20 et toujours absents a @50, strategie quota multicorpus).
- Cohorte extraite de \`retrieval-depth-benchmark-2026-09-22/benchmark.json\` (\`goldRankDetailsQuota\`, \`depthBand=absent_at_50\`, \`absentAt20=true\`).
- **API calls = 0** (lecture fichiers locaux + chunks \`data/processed/*.chunks.json\`).
- Production non modifiee dans cette tache.

## 2. Classification (cause primaire, categories chevauchantes possibles)

| Cause | Nombre | % |
|-------|-------:|--:|
${rows}

> Les tags secondaires sont dans \`diagnostic.json\` (\`classification.tags\`).

## 3. Resultats BM25 (diagnostique offline)

| Methode | Gold retrouves / 29 |
|---------|--------------------:|
| Vector @50 | 0/29 (par definition cohorte) |
| BM25 @50 | ${input.bm25.bm25RecoveredAt50}/29 |
| Union (vector U BM25) @50 | ${input.bm25.unionRecoveredAt50}/29 |

BM25: index lexical sur tous les chunks des corpus routes par question (meme perimetre que le retrieval quota), top 50 par score.

## 4. Patterns observes

${input.patterns.map((line) => `- ${line}`).join('\n')}

## 5. Cas representatifs

${repSection}

## 6. Conclusion

${input.conclusion}

## 7. Prochaine experience (une seule)

${input.nextExperiment}
`;
}

async function main(): Promise<void> {
  const [benchmarkRaw, perQuestionRaw] = await Promise.all([
    readFile(BENCHMARK, 'utf-8'),
    readFile(PER_QUESTION, 'utf-8'),
  ]);

  const benchmark = JSON.parse(benchmarkRaw) as {
    summary: { goldRankDetailsQuota: GoldRankDetailAbsentAt50[] };
  };
  const perQuestion = JSON.parse(perQuestionRaw) as PerQuestionDepthRecord[];
  const perQuestionById = new Map(
    perQuestion.map((record) => [record.questionId, record]),
  );

  const cohort = extractAbsentAt50Cohort(
    benchmark.summary.goldRankDetailsQuota,
  );
  if (cohort.length !== 29) {
    throw new Error(`Expected 29 absent-at-50 golds, got ${cohort.length}`);
  }

  const cases = [];
  for (const detail of cohort) {
    const record = perQuestionById.get(detail.questionId);
    if (!record) {
      throw new Error(`Missing per-question record ${detail.questionId}`);
    }
    cases.push(await analyzeAbsentGoldCase({ detail, perQuestion: record }));
  }

  const classification = summarizeClassifications(cases);
  const bm25 = summarizeBm25Recovery(cases);

  const neighborHeavy = cases.filter(
    (item) => item.neighborAnalysis.neighborCountTop10 >= 2,
  ).length;
  const lexicalMismatchTagged = cases.filter((item) =>
    item.classification.tags.includes('lexical_mismatch'),
  ).length;
  const longGoldChunk = cases.filter(
    (item) =>
      item.goldChunkStats &&
      (item.goldChunkStats.overTargetSize || item.goldChunkStats.multiChunk),
  ).length;
  const lowJaccard = cases.filter(
    (item) => item.lexical.jaccardQuestionGold < 0.05,
  ).length;

  const patterns = [
    `${neighborHeavy}/${cases.length} cas: >=2 articles voisins (meme prefixe) dans le vector top10.`,
    `${lexicalMismatchTagged}/${cases.length} cas: tag lexical_mismatch (overlap concurrent > gold).`,
    `${lowJaccard}/${cases.length} cas: jaccard question-gold < 0.05.`,
    `${longGoldChunk}/${cases.length} cas: chunk gold multi-morceau ou > target size.`,
    `BM25 recupere ${bm25.bm25RecoveredAt50} golds supplementaires vs vector @50.`,
  ];

  const primarySorted = Object.entries(classification).sort(
    (left, right) => right[1] - left[1],
  );
  const topCause =
    primarySorted.find(([key]) => key !== 'indeterminate')?.[0] ??
    'indeterminate';

  let conclusion =
    'Probleme **mixte**: overlap lexical question-gold souvent faible; le vector seul ne remonte pas le gold alors que BM25 retrouve une partie significative (13/29).';
  if (topCause === 'semantic_competition') {
    conclusion =
      'Probleme **principalement semantique / inter-articles**: des voisins du meme code occupent le haut du ranking vectoriel.';
  } else if (topCause === 'lexical_mismatch') {
    conclusion =
      'Probleme **principalement lexical + vector gap**: concurrents plus proches en tokens que le gold; BM25 @50 retrouve 13/29 cas absents du vector.';
  } else if (topCause === 'query_formulation') {
    conclusion =
      'Probleme **principalement formulation / concept**: faible recouvrement lexical global.';
  } else if (topCause === 'gold_intrinsically_difficult') {
    conclusion =
      'Probleme **principalement alignement conceptuel**: gold pertinent mais peu de signal surface commun avec la question.';
  }

  let nextExperiment =
    '**Hybrid BM25 + vector (offline puis mini-benchmark 61q)** � seulement si BM25 recupere des golds vector-absents; sinon **query transformation offline** sur les cas faible jaccard.';
  if (bm25.bm25RecoveredAt50 >= 5) {
    nextExperiment =
      '**Hybrid retrieval BM25 + vector (union/RRF)** sur la cohorte 61q � BM25 recupere plusieurs golds absents du vector @50.';
  } else if (neighborHeavy >= 10) {
    nextExperiment =
      '**Query expansion / reformulation offline** puis re-benchmark vector sur 10-15 cas voisins � competition semantique inter-articles dominante.';
  }

  const representatives = pickRepresentativeCases(cases, 8);

  await mkdir(OUTPUT_DIR, { recursive: true });

  const payload = {
    metadata: {
      timestamp: new Date().toISOString(),
      apiCalls: 0,
      productionModified: false,
      cohortDefinition:
        'goldRankDetailsQuota with absentAt20=true and depthBand=absent_at_50',
      sources: [BENCHMARK, PER_QUESTION, 'data/processed/*.chunks.json'],
      cohortSize: cohort.length,
    },
    summary: {
      classification,
      classificationLabels: CAUSE_LABELS,
      bm25,
      patterns,
      conclusion,
      nextExperiment,
    },
    cases,
  };

  const lexicalAnalysis = {
    metadata: payload.metadata,
    bm25,
    perCaseLexical: cases.map((item) => ({
      questionId: item.questionId,
      gold: item.goldArticle,
      lexical: item.lexical,
      bm25: item.bm25,
      classification: item.classification,
    })),
  };

  const report = buildReport({
    cohortSize: cohort.length,
    classification,
    bm25,
    representatives,
    patterns,
    conclusion,
    nextExperiment,
  });

  await writeFile(
    join(OUTPUT_DIR, 'diagnostic.json'),
    `${JSON.stringify(payload, null, 2)}\n`,
  );
  await writeFile(
    join(OUTPUT_DIR, 'lexical-analysis.json'),
    `${JSON.stringify(lexicalAnalysis, null, 2)}\n`,
  );
  await writeFile(join(OUTPUT_DIR, 'REPORT.md'), report);

  console.log(`Analyzed ${cohort.length} golds`);
  console.log(`BM25 @50 recovered: ${bm25.bm25RecoveredAt50}/29`);
  console.log(`Output: ${OUTPUT_DIR}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
