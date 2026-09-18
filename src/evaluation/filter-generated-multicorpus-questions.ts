import { normalizeQuestionText } from './load-multicorpus-dataset.js';
import type { MulticorpusCorpusArticleRegistry } from './load-corpus-article-index.js';
import { articleExistsInCorpus } from './load-corpus-article-index.js';
import type { GeneratedQuestionCandidate } from './generate-multicorpus-questions.js';
import type { LegalMulticorpusEvaluationQuestion } from './multicorpus-dataset.types.js';

export interface FilterGeneratedQuestionsOptions {
  expectedQuestionType?: LegalMulticorpusEvaluationQuestion['questionType'];
  expectedCorpusIds?: string[];
}

export function isValidGeneratedQuestion(
  candidate: GeneratedQuestionCandidate,
  registry: MulticorpusCorpusArticleRegistry,
  options: FilterGeneratedQuestionsOptions = {},
): boolean {
  if (!candidate.question.trim() || !candidate.referenceAnswer.trim()) {
    return false;
  }

  if (options.expectedQuestionType && candidate.questionType !== options.expectedQuestionType) {
    return false;
  }

  if (candidate.goldArticles.length === 0) {
    return false;
  }

  if (candidate.questionType === 'single-corpus' && candidate.goldCorpusIds.length !== 1) {
    return false;
  }

  if (candidate.questionType === 'multi-corpus' && candidate.goldCorpusIds.length < 2) {
    return false;
  }

  if (options.expectedCorpusIds) {
    const expected = [...options.expectedCorpusIds].sort().join('|');
    const actual = [...candidate.goldCorpusIds].sort().join('|');
    if (expected !== actual && options.expectedQuestionType === 'single-corpus') {
      return false;
    }
  }

  for (const goldArticle of candidate.goldArticles) {
    const exists = candidate.goldCorpusIds.some((corpusId) =>
      articleExistsInCorpus(registry, corpusId, goldArticle),
    );
    if (!exists) {
      return false;
    }
  }

  return true;
}

export function dedupeGeneratedQuestions(
  candidates: GeneratedQuestionCandidate[],
): GeneratedQuestionCandidate[] {
  const seenQuestions = new Set<string>();
  const seenGold = new Set<string>();
  const unique: GeneratedQuestionCandidate[] = [];

  for (const candidate of candidates) {
    const normalizedQuestion = normalizeQuestionText(candidate.question);
    const goldKey = `${candidate.goldCorpusIds.sort().join('|')}::${candidate.goldArticles.sort().join('|')}`;

    if (seenQuestions.has(normalizedQuestion) || seenGold.has(`${normalizedQuestion}::${goldKey}`)) {
      continue;
    }

    seenQuestions.add(normalizedQuestion);
    seenGold.add(`${normalizedQuestion}::${goldKey}`);
    unique.push(candidate);
  }

  return unique;
}
