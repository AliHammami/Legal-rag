import type { LegalMulticorpusEvaluationQuestion } from './multicorpus-dataset.types.js';

function extractArticleNumber(value: string): string {
  const trimmed = value.trim();
  const articlePrefixMatch = trimmed.match(/(?:article\s+)(.+)$/i);
  if (articlePrefixMatch?.[1]) {
    return articlePrefixMatch[1].trim();
  }

  const corpusPrefixMatch = trimmed.match(
    /^code(?:-[a-z0-9-]+| du [a-z???????????-]+| de [a-z???????????-]+)\s+(.+)$/i,
  );
  if (corpusPrefixMatch?.[1]) {
    return corpusPrefixMatch[1].trim();
  }

  const corpusSuffixMatch = trimmed.match(/^(.+?)\s+(?:code-|code du |code de )/i);
  if (corpusSuffixMatch?.[1]) {
    return corpusSuffixMatch[1].trim();
  }

  return trimmed;
}

export function sanitizeMulticorpusDatasetQuestion(
  question: LegalMulticorpusEvaluationQuestion,
): LegalMulticorpusEvaluationQuestion {
  const goldCorpusIds = [...new Set(question.goldCorpusIds)];
  const goldArticles = [...new Set(question.goldArticles.map(extractArticleNumber))];
  const sourceArticles = question.sourceArticles
    ? [...new Set(question.sourceArticles.map(extractArticleNumber))]
    : undefined;

  return {
    ...question,
    goldCorpusIds,
    goldArticles,
    sourceArticles: sourceArticles
      ? [...new Set([...sourceArticles, ...goldArticles])]
      : [...goldArticles],
  };
}

export function sanitizeMulticorpusDataset(
  questions: LegalMulticorpusEvaluationQuestion[],
): LegalMulticorpusEvaluationQuestion[] {
  return questions.map(sanitizeMulticorpusDatasetQuestion);
}
