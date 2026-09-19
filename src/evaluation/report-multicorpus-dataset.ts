import { ALL_CORPUS_IDS } from '../ingestion/corpus-config.js';
import { goldArticleKey } from './gold-article.js';
import { mergeDuplicateGroups, detectMulticorpusDuplicates } from './detect-multicorpus-duplicates.js';
import type {
  LegalMulticorpusEvaluationQuestion,
  MulticorpusCorpusStats,
  MulticorpusDatasetReport,
} from './multicorpus-dataset.types.js';

function countByQuestionType(
  questions: LegalMulticorpusEvaluationQuestion[],
): Record<string, number> {
  return {
    'single-corpus': questions.filter((q) => q.questionType === 'single-corpus').length,
    'multi-corpus': questions.filter((q) => q.questionType === 'multi-corpus').length,
    ambiguous: questions.filter((q) => q.questionType === 'ambiguous').length,
    'out-of-scope': questions.filter((q) => q.questionType === 'out-of-scope').length,
  };
}

function countByDifficulty(
  questions: LegalMulticorpusEvaluationQuestion[],
): Record<string, number> {
  return {
    easy: questions.filter((q) => q.difficulty === 'easy').length,
    medium: questions.filter((q) => q.difficulty === 'medium').length,
    hard: questions.filter((q) => q.difficulty === 'hard').length,
  };
}

function computeCorpusStats(
  questions: LegalMulticorpusEvaluationQuestion[],
): MulticorpusCorpusStats[] {
  return ALL_CORPUS_IDS.map((corpusId) => {
    const relatedQuestions = questions.filter((question) =>
      question.goldCorpusIds.includes(corpusId),
    );
    const distinctGoldArticles = new Set<string>();
    let goldArticleCount = 0;

    for (const question of relatedQuestions) {
      for (const article of question.goldArticles) {
        distinctGoldArticles.add(goldArticleKey(article));
        goldArticleCount += 1;
      }
    }

    return {
      corpusId,
      questionCount: relatedQuestions.length,
      distinctGoldArticles: distinctGoldArticles.size,
      averageGoldArticles:
        relatedQuestions.length === 0
          ? 0
          : goldArticleCount / relatedQuestions.length,
    };
  });
}

function computeMultiCorpusCombinations(
  questions: LegalMulticorpusEvaluationQuestion[],
): Array<{ combination: string; count: number }> {
  const counts = new Map<string, number>();

  for (const question of questions) {
    if (question.questionType !== 'multi-corpus') {
      continue;
    }

    const combination = [...question.goldCorpusIds].sort().join(' + ');
    counts.set(combination, (counts.get(combination) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([combination, count]) => ({ combination, count }))
    .sort((left, right) => right.count - left.count || left.combination.localeCompare(right.combination));
}

function computeArticleCoverage(
  questions: LegalMulticorpusEvaluationQuestion[],
): Record<string, number> {
  const coverage: Record<string, number> = {};
  for (const corpusId of ALL_CORPUS_IDS) {
    coverage[corpusId] = 0;
  }

  const seenByCorpus = new Map<string, Set<string>>();
  for (const corpusId of ALL_CORPUS_IDS) {
    seenByCorpus.set(corpusId, new Set());
  }

  for (const question of questions) {
    for (const corpusId of question.goldCorpusIds) {
      const seen = seenByCorpus.get(corpusId);
      if (!seen) {
        continue;
      }
      for (const article of question.goldArticles) {
        seen.add(goldArticleKey(article));
      }
    }
  }

  for (const corpusId of ALL_CORPUS_IDS) {
    coverage[corpusId] = seenByCorpus.get(corpusId)?.size ?? 0;
  }

  return coverage;
}

function computeOverrepresentedArticles(
  questions: LegalMulticorpusEvaluationQuestion[],
  threshold = 3,
): Array<{ corpusId: string; articleNumber: string; count: number }> {
  const counts = new Map<string, number>();

  for (const question of questions) {
    for (const article of question.goldArticles) {
      const key = goldArticleKey(article);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .filter(([, count]) => count >= threshold)
    .map(([key, count]) => {
      const [corpusId, articleNumber] = key.split('::');
      return { corpusId: corpusId!, articleNumber: articleNumber!, count };
    })
    .sort((left, right) => right.count - left.count || left.corpusId.localeCompare(right.corpusId));
}

export function buildMulticorpusDatasetReport(
  questions: LegalMulticorpusEvaluationQuestion[],
): MulticorpusDatasetReport {
  return {
    totalQuestions: questions.length,
    byQuestionType: countByQuestionType(questions) as MulticorpusDatasetReport['byQuestionType'],
    byDifficulty: countByDifficulty(questions) as MulticorpusDatasetReport['byDifficulty'],
    byCorpus: computeCorpusStats(questions),
    multiCorpusCombinations: computeMultiCorpusCombinations(questions),
    articleCoverageByCorpus: computeArticleCoverage(questions),
    overrepresentedArticles: computeOverrepresentedArticles(questions),
    duplicateGroups: mergeDuplicateGroups(detectMulticorpusDuplicates(questions)),
  };
}

export function formatMulticorpusDatasetReport(report: MulticorpusDatasetReport): string {
  const lines: string[] = [];

  lines.push('=== Multicorpus Evaluation Dataset Report ===');
  lines.push('');
  lines.push(`Total questions: ${report.totalQuestions}`);
  lines.push('');
  lines.push('By question type:');
  for (const [questionType, count] of Object.entries(report.byQuestionType)) {
    lines.push(`  ${questionType}: ${count}`);
  }
  lines.push('');
  lines.push('By difficulty:');
  for (const [difficulty, count] of Object.entries(report.byDifficulty)) {
    lines.push(`  ${difficulty}: ${count}`);
  }
  lines.push('');
  lines.push('By corpus:');
  for (const corpus of report.byCorpus) {
    lines.push(
      `  ${corpus.corpusId}: ${corpus.questionCount} questions, ${corpus.distinctGoldArticles} distinct gold articles, avg ${corpus.averageGoldArticles.toFixed(2)} gold articles/question`,
    );
  }
  lines.push('');
  lines.push('Multi-corpus combinations:');
  if (report.multiCorpusCombinations.length === 0) {
    lines.push('  (none)');
  } else {
    for (const entry of report.multiCorpusCombinations) {
      lines.push(`  ${entry.combination}: ${entry.count}`);
    }
  }
  lines.push('');
  lines.push('Article coverage by corpus (distinct gold articles referenced):');
  for (const [corpusId, count] of Object.entries(report.articleCoverageByCorpus)) {
    lines.push(`  ${corpusId}: ${count}`);
  }
  lines.push('');
  lines.push('Overrepresented articles (>= 3 references):');
  if (report.overrepresentedArticles.length === 0) {
    lines.push('  (none)');
  } else {
    for (const entry of report.overrepresentedArticles.slice(0, 20)) {
      lines.push(`  ${entry.corpusId} / ${entry.articleNumber}: ${entry.count}`);
    }
  }
  lines.push('');
  lines.push('Suspected duplicate groups:');
  if (report.duplicateGroups.length === 0) {
    lines.push('  (none)');
  } else {
    for (const group of report.duplicateGroups) {
      lines.push(
        `  ${group.questionIds.join(', ')} � ${group.reason} (similarity ${group.similarity.toFixed(2)})`,
      );
    }
  }

  return lines.join('\n');
}

export function formatMulticorpusDatasetValidationReport(
  summary: import('./multicorpus-dataset.types.js').MulticorpusDatasetValidationSummary,
): string {
  const lines: string[] = [];
  lines.push('=== Multicorpus Evaluation Dataset Validation ===');
  lines.push('');
  lines.push(`Questions: ${summary.questionCount}`);
  lines.push(`Valid: ${summary.isValid ? 'yes' : 'no'}`);
  lines.push('');

  const sections: Array<[string, string[]]> = [
    ['Duplicate IDs', summary.duplicateIds],
    ['Duplicate questions', summary.duplicateQuestions],
    ['Invalid structure', summary.invalidStructure],
    ['Question type consistency', summary.invalidQuestionTypeConsistency],
    ['Invalid corpus IDs', summary.invalidGoldCorpusIds],
    ['Missing corpus articles', summary.missingCorpusArticles],
    ['Invalid sourceArticles', summary.invalidSourceArticles],
    ['Invalid difficulty', summary.invalidDifficulty],
    ['Distribution issues', summary.distributionIssues],
  ];

  for (const [title, items] of sections) {
    lines.push(`${title}: ${items.length}`);
    for (const item of items.slice(0, 10)) {
      lines.push(`  - ${item}`);
    }
    if (items.length > 10) {
      lines.push(`  ... and ${items.length - 10} more`);
    }
    lines.push('');
  }

  lines.push(`Suspected duplicate groups: ${summary.duplicateGroups.length}`);
  for (const group of summary.duplicateGroups.slice(0, 10)) {
    lines.push(
      `  - ${group.questionIds.join(', ')} (${group.reason}, similarity ${group.similarity.toFixed(2)})`,
    );
  }

  return lines.join('\n');
}
