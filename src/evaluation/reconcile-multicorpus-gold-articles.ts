import { ALL_CORPUS_IDS } from '../ingestion/corpus-config.js';
import type { GoldArticle } from './gold-article.js';
import { goldArticleKey, goldCorpusIdsFromArticles } from './gold-article.js';
import type { MulticorpusCorpusArticleRegistry } from './load-corpus-article-index.js';
import { articleExistsInCorpus } from './load-corpus-article-index.js';
import {
  MULTICORPUS_GOLD_ARTICLE_OVERRIDES,
  MULTICORPUS_QUESTION_METADATA_OVERRIDES,
} from './multicorpus-gold-article-overrides.js';
import type { LegalMulticorpusEvaluationQuestion } from './multicorpus-dataset.types.js';

const CORPUS_KEYWORDS: Record<string, string[]> = {
  'code-penal': ['code p?nal', 'code penal', 'p?nal', 'penal'],
  'code-civil': ['code civil', 'civil'],
  'code-du-travail': ['code du travail', 'travail'],
  'code-du-commerce': ['code de commerce', 'code du commerce', 'commerce'],
  'code-monetaire-et-financier': [
    'code mon?taire',
    'code monetaire',
    'mon?taire',
    'monetaire',
    'financier',
  ],
  'code-de-la-consommation': [
    'code de la consommation',
    'consommation',
  ],
};

export interface ReconcileGoldArticleResult {
  articleNumber: string;
  resolved?: GoldArticle;
  candidateCorpusIds: string[];
  ambiguous: boolean;
  reason?: string;
}

export interface ReconcileQuestionResult {
  questionId: string;
  resolved: GoldArticle[];
  issues: ReconcileGoldArticleResult[];
  unresolved: boolean;
}

export interface ReconcileMulticorpusReport {
  questionCount: number;
  resolvedCount: number;
  unresolvedQuestions: ReconcileQuestionResult[];
}

function corpusMentionedNearArticle(
  text: string,
  articleNumber: string,
  corpusId: string,
): boolean {
  const lowerText = text.toLowerCase();
  const articleIndex = lowerText.indexOf(articleNumber.toLowerCase());
  if (articleIndex < 0) {
    return false;
  }

  const windowStart = Math.max(0, articleIndex - 120);
  const windowEnd = Math.min(text.length, articleIndex + articleNumber.length + 120);
  const window = lowerText.slice(windowStart, windowEnd);

  return (CORPUS_KEYWORDS[corpusId] ?? []).some((keyword) =>
    window.includes(keyword),
  );
}

function candidateCorporaForArticle(
  registry: MulticorpusCorpusArticleRegistry,
  articleNumber: string,
  allowedCorpusIds: string[],
): string[] {
  return allowedCorpusIds.filter((corpusId) =>
    articleExistsInCorpus(registry, corpusId, articleNumber),
  );
}

function resolveArticleCorpus(
  articleNumber: string,
  allowedCorpusIds: string[],
  registry: MulticorpusCorpusArticleRegistry,
  referenceAnswer: string,
  questionText: string,
): ReconcileGoldArticleResult {
  const candidates = candidateCorporaForArticle(
    registry,
    articleNumber,
    allowedCorpusIds.length > 0 ? allowedCorpusIds : ALL_CORPUS_IDS,
  );

  if (candidates.length === 0) {
    return {
      articleNumber,
      candidateCorpusIds: [],
      ambiguous: true,
      reason: 'article not found in allowed corpora',
    };
  }

  if (candidates.length === 1) {
    return {
      articleNumber,
      candidateCorpusIds: candidates,
      ambiguous: false,
      resolved: {
        corpusId: candidates[0]!,
        articleNumber,
      },
    };
  }

  const narrowed = candidates.filter(
    (corpusId) =>
      corpusMentionedNearArticle(referenceAnswer, articleNumber, corpusId) ||
      corpusMentionedNearArticle(questionText, articleNumber, corpusId),
  );

  if (narrowed.length === 1) {
    return {
      articleNumber,
      candidateCorpusIds: candidates,
      ambiguous: false,
      resolved: {
        corpusId: narrowed[0]!,
        articleNumber,
      },
    };
  }

  return {
    articleNumber,
    candidateCorpusIds: candidates,
    ambiguous: true,
    reason: `article exists in multiple corpora: ${candidates.join(', ')}`,
  };
}

function assignMultiCorpusArticles(
  articleNumbers: string[],
  goldCorpusIds: string[],
  registry: MulticorpusCorpusArticleRegistry,
  referenceAnswer: string,
  questionText: string,
): ReconcileGoldArticleResult[] {
  const pending = articleNumbers.map((articleNumber) => ({
    articleNumber,
    candidates: candidateCorporaForArticle(registry, articleNumber, goldCorpusIds),
  }));

  const assignments = new Map<string, GoldArticle>();
  const issues: ReconcileGoldArticleResult[] = [];

  for (const entry of pending.sort(
    (left, right) => left.candidates.length - right.candidates.length,
  )) {
    if (entry.candidates.length === 0) {
      issues.push({
        articleNumber: entry.articleNumber,
        candidateCorpusIds: [],
        ambiguous: true,
        reason: 'article not found in declared gold corpora',
      });
      continue;
    }

    const unusedCandidates = entry.candidates.filter(
      (corpusId) =>
        !Array.from(assignments.values()).some(
          (assigned) =>
            assigned.corpusId === corpusId &&
            assigned.articleNumber === entry.articleNumber,
        ),
    );

    const narrowed = unusedCandidates.filter(
      (corpusId) =>
        corpusMentionedNearArticle(referenceAnswer, entry.articleNumber, corpusId) ||
        corpusMentionedNearArticle(questionText, entry.articleNumber, corpusId),
    );

    const chosen =
      narrowed.length === 1
        ? narrowed[0]
        : unusedCandidates.length === 1
          ? unusedCandidates[0]
          : entry.candidates.length === 1
            ? entry.candidates[0]
            : undefined;

    if (!chosen) {
      issues.push({
        articleNumber: entry.articleNumber,
        candidateCorpusIds: entry.candidates,
        ambiguous: true,
        reason: `unable to disambiguate among ${entry.candidates.join(', ')}`,
      });
      continue;
    }

    assignments.set(entry.articleNumber, {
      corpusId: chosen,
      articleNumber: entry.articleNumber,
    });
    issues.push({
      articleNumber: entry.articleNumber,
      candidateCorpusIds: entry.candidates,
      ambiguous: false,
      resolved: assignments.get(entry.articleNumber),
    });
  }

  return issues;
}

export function reconcileQuestionGoldArticles(
  question: Pick<
    LegalMulticorpusEvaluationQuestion,
    'id' | 'question' | 'goldCorpusIds' | 'goldArticles' | 'referenceAnswer' | 'questionType'
  >,
  registry: MulticorpusCorpusArticleRegistry,
): ReconcileQuestionResult {
  const manualOverride = MULTICORPUS_GOLD_ARTICLE_OVERRIDES[question.id];
  if (manualOverride) {
    return {
      questionId: question.id,
      resolved: manualOverride,
      issues: manualOverride.map((article) => ({
        articleNumber: article.articleNumber,
        candidateCorpusIds: [article.corpusId],
        ambiguous: false,
        resolved: article,
        reason: 'manual override',
      })),
      unresolved: false,
    };
  }

  if (question.goldArticles.length === 0) {
    return {
      questionId: question.id,
      resolved: [],
      issues: [],
      unresolved: false,
    };
  }

  const legacyArticleNumbers = question.goldArticles.map((article) =>
    typeof article === 'string' ? article : article.articleNumber,
  );

  const issues: ReconcileGoldArticleResult[] = [];

  if (question.questionType === 'single-corpus') {
    const corpusId = question.goldCorpusIds[0];
    if (!corpusId) {
      return {
        questionId: question.id,
        resolved: [],
        issues: [
          {
            articleNumber: '*',
            candidateCorpusIds: [],
            ambiguous: true,
            reason: 'single-corpus question missing goldCorpusId',
          },
        ],
        unresolved: true,
      };
    }

    for (const articleNumber of legacyArticleNumbers) {
      if (!articleExistsInCorpus(registry, corpusId, articleNumber)) {
        issues.push({
          articleNumber,
          candidateCorpusIds: [corpusId],
          ambiguous: true,
          reason: `article not found in ${corpusId}`,
        });
        continue;
      }

      issues.push({
        articleNumber,
        candidateCorpusIds: [corpusId],
        ambiguous: false,
        resolved: { corpusId, articleNumber },
      });
    }
  } else {
    issues.push(
      ...assignMultiCorpusArticles(
        legacyArticleNumbers,
        question.goldCorpusIds,
        registry,
        question.referenceAnswer,
        question.question,
      ),
    );
  }

  const resolved = issues
    .map((issue) => issue.resolved)
    .filter((article): article is GoldArticle => article !== undefined);

  return {
    questionId: question.id,
    resolved,
    issues,
    unresolved: issues.some((issue) => issue.ambiguous && !issue.resolved),
  };
}

export function reconcileMulticorpusGoldArticles(
  questions: LegalMulticorpusEvaluationQuestion[],
  registry: MulticorpusCorpusArticleRegistry,
): ReconcileMulticorpusReport {
  const results = questions.map((question) =>
    reconcileQuestionGoldArticles(question, registry),
  );

  return {
    questionCount: questions.length,
    resolvedCount: results.filter((result) => !result.unresolved).length,
    unresolvedQuestions: results.filter((result) => result.unresolved),
  };
}

export function applyReconciledGoldArticles(
  question: LegalMulticorpusEvaluationQuestion,
  resolved: GoldArticle[],
): LegalMulticorpusEvaluationQuestion {
  const metadataOverride = MULTICORPUS_QUESTION_METADATA_OVERRIDES[question.id];
  const questionType = metadataOverride?.questionType ?? question.questionType;
  const goldCorpusIds =
    questionType === 'ambiguous' || questionType === 'out-of-scope'
      ? []
      : metadataOverride?.goldCorpusIds ??
        [...new Set(resolved.map((article) => article.corpusId))].sort();

  return {
    ...question,
    questionType,
    goldCorpusIds,
    goldArticles: resolved,
    sourceArticles: resolved.length > 0 ? resolved : undefined,
  };
}

export function formatReconcileMulticorpusReport(
  report: ReconcileMulticorpusReport,
): string {
  const lines = [
    '=== Multicorpus Gold Article Reconciliation ===',
    '',
    `Questions: ${report.questionCount}`,
    `Fully resolved: ${report.resolvedCount}`,
    `Unresolved: ${report.unresolvedQuestions.length}`,
    '',
  ];

  for (const unresolved of report.unresolvedQuestions.slice(0, 20)) {
    lines.push(`Question ${unresolved.questionId}:`);
    for (const issue of unresolved.issues.filter((entry) => entry.ambiguous)) {
      lines.push(
        `  - ${issue.articleNumber}: ${issue.reason ?? 'ambiguous'} (${issue.candidateCorpusIds.join(', ') || 'none'})`,
      );
    }
    lines.push('');
  }

  if (report.unresolvedQuestions.length > 20) {
    lines.push(`... and ${report.unresolvedQuestions.length - 20} more unresolved questions`);
  }

  return lines.join('\n');
}

export function validateGoldCorpusArticleConsistency(
  question: LegalMulticorpusEvaluationQuestion,
): string[] {
  const issues: string[] = [];

  if (question.questionType === 'ambiguous' || question.questionType === 'out-of-scope') {
    if (question.goldArticles.length > 0) {
      issues.push(`${question.id}: expected empty goldArticles`);
    }
    return issues;
  }

  const corpusFromArticles = goldCorpusIdsFromArticles(question.goldArticles);
  const expected = [...question.goldCorpusIds].sort().join('|');
  const actual = corpusFromArticles.sort().join('|');

  if (expected !== actual) {
    issues.push(
      `${question.id}: goldCorpusIds (${question.goldCorpusIds.join(', ')}) != corpusIds from goldArticles (${corpusFromArticles.join(', ')})`,
    );
  }

  return issues;
}
