import { ALL_CORPUS_IDS } from '../ingestion/corpus-config.js';
import {
  mergeDuplicateGroups,
  detectMulticorpusDuplicates,
} from './detect-multicorpus-duplicates.js';
import {
  validateMulticorpusQuestionIds,
  validateMulticorpusQuestionTexts,
} from './load-multicorpus-dataset.js';
import type { MulticorpusCorpusArticleRegistry } from './load-corpus-article-index.js';
import { articleExistsInCorpus } from './load-corpus-article-index.js';
import { goldArticleKey } from './gold-article.js';
import { validateGoldCorpusArticleConsistency } from './reconcile-multicorpus-gold-articles.js';
import type {
  LegalMulticorpusEvaluationQuestion,
  MulticorpusDatasetValidationSummary,
} from './multicorpus-dataset.types.js';
import {
  MULTICORPUS_DATASET_QUOTAS,
  MULTICORPUS_DIFFICULTY_TARGETS,
  MULTICORPUS_SINGLE_CORPUS_QUOTAS,
} from './multicorpus-dataset.types.js';

const KNOWN_CORPUS_IDS = new Set(ALL_CORPUS_IDS);

function countByQuestionType(
  questions: LegalMulticorpusEvaluationQuestion[],
): Record<string, number> {
  const counts: Record<string, number> = {
    'single-corpus': 0,
    'multi-corpus': 0,
    ambiguous: 0,
    'out-of-scope': 0,
  };

  for (const question of questions) {
    counts[question.questionType] = (counts[question.questionType] ?? 0) + 1;
  }

  return counts;
}

function countByDifficulty(
  questions: LegalMulticorpusEvaluationQuestion[],
): Record<string, number> {
  const counts: Record<string, number> = { easy: 0, medium: 0, hard: 0 };
  for (const question of questions) {
    counts[question.difficulty] = (counts[question.difficulty] ?? 0) + 1;
  }
  return counts;
}

function countSingleCorpusByCorpus(
  questions: LegalMulticorpusEvaluationQuestion[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const corpusId of ALL_CORPUS_IDS) {
    counts[corpusId] = 0;
  }

  for (const question of questions) {
    if (question.questionType !== 'single-corpus') {
      continue;
    }
    const corpusId = question.goldCorpusIds[0];
    if (corpusId) {
      counts[corpusId] = (counts[corpusId] ?? 0) + 1;
    }
  }

  return counts;
}

function validateQuestionTypeConsistency(
  questions: LegalMulticorpusEvaluationQuestion[],
): string[] {
  const issues: string[] = [];

  for (const question of questions) {
    const { questionType, goldCorpusIds, goldArticles } = question;

    if (questionType === 'single-corpus') {
      if (goldCorpusIds.length !== 1) {
        issues.push(
          `${question.id}: single-corpus must have exactly 1 goldCorpusId`,
        );
      }
      if (goldArticles.length === 0) {
        issues.push(`${question.id}: single-corpus must have goldArticles`);
      }
    }

    if (questionType === 'multi-corpus') {
      if (new Set(goldCorpusIds).size < 2) {
        issues.push(
          `${question.id}: multi-corpus must have at least 2 distinct goldCorpusIds`,
        );
      }
      if (goldArticles.length === 0) {
        issues.push(`${question.id}: multi-corpus must have goldArticles`);
      }
    }

    if (questionType === 'ambiguous' || questionType === 'out-of-scope') {
      if (goldCorpusIds.length > 0) {
        issues.push(
          `${question.id}: ${questionType} must have goldCorpusIds = []`,
        );
      }
      if (goldArticles.length > 0) {
        issues.push(
          `${question.id}: ${questionType} must have goldArticles = []`,
        );
      }
    }
  }

  return issues;
}

function validateGoldCorpusIds(
  questions: LegalMulticorpusEvaluationQuestion[],
): string[] {
  const issues: string[] = [];

  for (const question of questions) {
    for (const corpusId of question.goldCorpusIds) {
      if (!KNOWN_CORPUS_IDS.has(corpusId)) {
        issues.push(`${question.id}: unknown corpusId ${corpusId}`);
      }
    }
  }

  return issues;
}

function validateGoldArticlesInRegistry(
  questions: LegalMulticorpusEvaluationQuestion[],
  registry: MulticorpusCorpusArticleRegistry,
): string[] {
  const issues: string[] = [];

  for (const question of questions) {
    if (question.goldArticles.length === 0) {
      continue;
    }

    if (question.goldCorpusIds.length === 0) {
      issues.push(
        `${question.id}: goldArticles present but goldCorpusIds is empty`,
      );
      continue;
    }

    for (const goldArticle of question.goldArticles) {
      if (
        !articleExistsInCorpus(
          registry,
          goldArticle.corpusId,
          goldArticle.articleNumber,
        )
      ) {
        issues.push(
          `${question.id}: gold article ${goldArticle.corpusId}/${goldArticle.articleNumber} not found`,
        );
      }
    }
  }

  return issues;
}

function validateSourceArticles(
  questions: LegalMulticorpusEvaluationQuestion[],
  registry: MulticorpusCorpusArticleRegistry,
): string[] {
  const issues: string[] = [];

  for (const question of questions) {
    if (!question.sourceArticles) {
      continue;
    }

    const sourceKeys = new Set(
      question.sourceArticles.map((article) => goldArticleKey(article)),
    );

    for (const sourceArticle of question.sourceArticles) {
      if (
        !articleExistsInCorpus(
          registry,
          sourceArticle.corpusId,
          sourceArticle.articleNumber,
        )
      ) {
        issues.push(
          `${question.id}: sourceArticle ${sourceArticle.corpusId}/${sourceArticle.articleNumber} not found`,
        );
      }
    }

    for (const goldArticle of question.goldArticles) {
      if (!sourceKeys.has(goldArticleKey(goldArticle))) {
        issues.push(
          `${question.id}: sourceArticles must include goldArticle ${goldArticle.corpusId}/${goldArticle.articleNumber}`,
        );
      }
    }
  }

  return issues;
}

function validateDistribution(
  questions: LegalMulticorpusEvaluationQuestion[],
): string[] {
  const issues: string[] = [];
  const totalExpected =
    MULTICORPUS_DATASET_QUOTAS.singleCorpus +
    MULTICORPUS_DATASET_QUOTAS.multiCorpus +
    MULTICORPUS_DATASET_QUOTAS.ambiguous +
    MULTICORPUS_DATASET_QUOTAS.outOfScope;

  if (questions.length !== totalExpected) {
    issues.push(
      `expected exactly ${totalExpected} questions, got ${questions.length}`,
    );
  }

  const byType = countByQuestionType(questions);
  if (byType['single-corpus'] !== MULTICORPUS_DATASET_QUOTAS.singleCorpus) {
    issues.push(
      `expected ${MULTICORPUS_DATASET_QUOTAS.singleCorpus} single-corpus questions, got ${byType['single-corpus']}`,
    );
  }
  if (byType['multi-corpus'] !== MULTICORPUS_DATASET_QUOTAS.multiCorpus) {
    issues.push(
      `expected ${MULTICORPUS_DATASET_QUOTAS.multiCorpus} multi-corpus questions, got ${byType['multi-corpus']}`,
    );
  }
  if (byType.ambiguous !== MULTICORPUS_DATASET_QUOTAS.ambiguous) {
    issues.push(
      `expected ${MULTICORPUS_DATASET_QUOTAS.ambiguous} ambiguous questions, got ${byType.ambiguous}`,
    );
  }
  if (byType['out-of-scope'] !== MULTICORPUS_DATASET_QUOTAS.outOfScope) {
    issues.push(
      `expected ${MULTICORPUS_DATASET_QUOTAS.outOfScope} out-of-scope questions, got ${byType['out-of-scope']}`,
    );
  }

  const singleCorpusCounts = countSingleCorpusByCorpus(questions);
  for (const [corpusId, expectedCount] of Object.entries(
    MULTICORPUS_SINGLE_CORPUS_QUOTAS,
  )) {
    const actual = singleCorpusCounts[corpusId] ?? 0;
    if (actual !== expectedCount) {
      issues.push(
        `expected ${expectedCount} single-corpus questions for ${corpusId}, got ${actual}`,
      );
    }
  }

  const byDifficulty = countByDifficulty(questions);
  for (const [difficulty, expectedCount] of Object.entries(
    MULTICORPUS_DIFFICULTY_TARGETS,
  )) {
    const actual = byDifficulty[difficulty] ?? 0;
    if (actual !== expectedCount) {
      issues.push(
        `expected ${expectedCount} ${difficulty} questions, got ${actual}`,
      );
    }
  }

  return issues;
}

export function validateMulticorpusEvaluationDataset(
  questions: LegalMulticorpusEvaluationQuestion[],
  registry: MulticorpusCorpusArticleRegistry,
): MulticorpusDatasetValidationSummary {
  const duplicateIds = validateMulticorpusQuestionIds(questions);
  const duplicateQuestions = validateMulticorpusQuestionTexts(questions);
  const invalidQuestionTypeConsistency = validateQuestionTypeConsistency(questions);
  const invalidGoldCorpusIds = validateGoldCorpusIds(questions);
  const missingCorpusArticles = validateGoldArticlesInRegistry(
    questions,
    registry,
  );
  const invalidSourceArticles = validateSourceArticles(questions, registry);
  const invalidCorpusArticleConsistency = questions.flatMap((question) =>
    validateGoldCorpusArticleConsistency(question),
  );
  const distributionIssues = validateDistribution(questions);
  const duplicateGroups = mergeDuplicateGroups(detectMulticorpusDuplicates(questions));

  const invalidStructure: string[] = [];
  for (const question of questions) {
    if (!question.referenceAnswer.trim()) {
      invalidStructure.push(`${question.id}: empty referenceAnswer`);
    }
    if (!question.question.trim()) {
      invalidStructure.push(`${question.id}: empty question`);
    }
  }

  const invalidDifficulty: string[] = [];
  for (const question of questions) {
    if (!['easy', 'medium', 'hard'].includes(question.difficulty)) {
      invalidDifficulty.push(`${question.id}: invalid difficulty`);
    }
  }

  const issues = [
    ...duplicateIds.map((id) => `duplicate id: ${id}`),
    ...duplicateQuestions.map((entry) => `duplicate question: ${entry}`),
    ...invalidStructure,
    ...invalidQuestionTypeConsistency,
    ...invalidGoldCorpusIds,
    ...missingCorpusArticles.map((entry) => `missing corpus article: ${entry}`),
    ...invalidSourceArticles,
    ...invalidCorpusArticleConsistency,
    ...invalidDifficulty,
    ...distributionIssues,
    ...duplicateGroups.map(
      (group) =>
        `suspected duplicate group: ${group.questionIds.join(', ')} (${group.reason})`,
    ),
  ];

  return {
    questionCount: questions.length,
    duplicateIds,
    duplicateQuestions,
    invalidStructure,
    invalidQuestionTypeConsistency,
    invalidGoldCorpusIds,
    missingCorpusArticles,
    invalidSourceArticles,
    invalidDifficulty,
    distributionIssues,
    duplicateGroups,
    isValid: issues.length === 0,
  };
}

export function assertValidMulticorpusEvaluationDataset(
  summary: MulticorpusDatasetValidationSummary,
): void {
  if (summary.isValid) {
    return;
  }

  const messages = [
    ...summary.duplicateIds.map((id) => `Duplicate id: ${id}`),
    ...summary.duplicateQuestions.map((entry) => `Duplicate question: ${entry}`),
    ...summary.invalidStructure,
    ...summary.invalidQuestionTypeConsistency,
    ...summary.invalidGoldCorpusIds,
    ...summary.missingCorpusArticles.map(
      (entry) => `Missing corpus article: ${entry}`,
    ),
    ...summary.invalidSourceArticles,
    ...summary.invalidDifficulty,
    ...summary.distributionIssues,
    ...summary.duplicateGroups.map(
      (group) =>
        `Suspected duplicate group: ${group.questionIds.join(', ')} (${group.reason})`,
    ),
  ];

  throw new Error(messages.join('\n'));
}
