import { writeFile } from 'node:fs/promises';

import { DEFAULT_MULTICORPUS_EVALUATION_DATASET_PATH } from '../src/evaluation/constants.js';
import { loadMulticorpusCorpusArticleRegistry } from '../src/evaluation/load-corpus-article-index.js';
import { loadLegacyMulticorpusEvaluationDataset } from '../src/evaluation/load-multicorpus-dataset.js';
import {
  applyReconciledGoldArticles,
  formatReconcileMulticorpusReport,
  reconcileQuestionGoldArticles,
} from '../src/evaluation/reconcile-multicorpus-gold-articles.js';
import type { LegalMulticorpusEvaluationQuestion } from '../src/evaluation/multicorpus-dataset.types.js';

function parseArgs(argv: string[]): { apply: boolean } {
  return { apply: argv.includes('--apply') };
}

function toLegacyQuestion(
  question: LegalMulticorpusEvaluationQuestion & {
    goldArticles: Array<string | { corpusId: string; articleNumber: string }>;
  },
): LegalMulticorpusEvaluationQuestion & { goldArticles: string[] } {
  return {
    ...question,
    goldArticles: question.goldArticles.map((article) =>
      typeof article === 'string' ? article : article.articleNumber,
    ),
  };
}

async function main(): Promise<void> {
  const { apply } = parseArgs(process.argv.slice(2));
  const questions = await loadLegacyMulticorpusEvaluationDataset(
    DEFAULT_MULTICORPUS_EVALUATION_DATASET_PATH,
  );
  const registry = await loadMulticorpusCorpusArticleRegistry();

  const results = questions.map((question) =>
    reconcileQuestionGoldArticles(toLegacyQuestion(question), registry),
  );

  const report = {
    questionCount: questions.length,
    resolvedCount: results.filter((result) => !result.unresolved).length,
    unresolvedQuestions: results.filter((result) => result.unresolved),
  };

  console.log(formatReconcileMulticorpusReport(report));

  if (report.unresolvedQuestions.length > 0) {
    if (apply) {
      throw new Error(
        `Cannot apply migration: ${report.unresolvedQuestions.length} unresolved questions`,
      );
    }
    console.log('');
    console.log('Resolve ambiguous cases before applying migration.');
    return;
  }

  if (!apply) {
    console.log('');
    console.log('Dry run only. Re-run with --apply to migrate the dataset.');
    return;
  }

  const migrated = questions.map((question, index) =>
    applyReconciledGoldArticles(question, results[index]!.resolved),
  );

  await writeFile(
    DEFAULT_MULTICORPUS_EVALUATION_DATASET_PATH,
    `${JSON.stringify(migrated, null, 2)}\n`,
    'utf-8',
  );

  console.log('');
  console.log(`Migrated ${migrated.length} questions to GoldArticle format.`);
}

main().catch((error: unknown) => {
  console.error('');
  console.error('? ERREUR FATALE');
  console.error('');

  if (error instanceof Error) {
    console.error(`Nom : ${error.name}`);
    console.error(`Message : ${error.message}`);
  } else {
    console.error(error);
  }

  process.exitCode = 1;
});
