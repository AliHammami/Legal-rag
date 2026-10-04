import type { CorpusArticleRecord } from './load-corpus-article-index.js';

const MIN_ARTICLE_LENGTH = 80;
const MAX_ARTICLE_LENGTH = 6000;

function articleSectionKey(article: CorpusArticleRecord): string {
  const metadata = article.metadata;
  return [
    metadata.partie ?? '',
    metadata.livre ?? '',
    metadata.titre ?? '',
    metadata.chapitre ?? '',
  ].join(' / ');
}

export function filterArticlesForQuestionGeneration(
  articles: CorpusArticleRecord[],
): CorpusArticleRecord[] {
  return articles.filter(
    (article) =>
      article.content.trim().length >= MIN_ARTICLE_LENGTH &&
      article.content.trim().length <= MAX_ARTICLE_LENGTH,
  );
}

export function selectDiverseArticles(
  articles: CorpusArticleRecord[],
  count: number,
  usedArticleNumbers: Set<string> = new Set(),
): CorpusArticleRecord[] {
  const eligible = filterArticlesForQuestionGeneration(articles).filter(
    (article) => !usedArticleNumbers.has(article.articleNumber),
  );

  if (eligible.length === 0) {
    return [];
  }

  const bySection = new Map<string, CorpusArticleRecord[]>();
  for (const article of eligible) {
    const key = articleSectionKey(article);
    const bucket = bySection.get(key) ?? [];
    bucket.push(article);
    bySection.set(key, bucket);
  }

  for (const bucket of bySection.values()) {
    bucket.sort((left, right) =>
      left.articleNumber.localeCompare(right.articleNumber, 'fr'),
    );
  }

  const sectionKeys = [...bySection.keys()].sort();
  const selected: CorpusArticleRecord[] = [];
  let sectionIndex = 0;

  while (selected.length < count && selected.length < eligible.length) {
    const sectionKey = sectionKeys[sectionIndex % sectionKeys.length]!;
    const bucket = bySection.get(sectionKey) ?? [];
    const nextArticle = bucket.shift();
    if (nextArticle) {
      selected.push(nextArticle);
      usedArticleNumbers.add(nextArticle.articleNumber);
    }
    sectionIndex += 1;

    if (sectionKeys.every((key) => (bySection.get(key)?.length ?? 0) === 0)) {
      break;
    }
  }

  return selected;
}

export interface MultiCorpusArticleBundle {
  corpusId: string;
  articleNumber: string;
  content: string;
}

export function buildMultiCorpusBundles(
  articlesByCorpus: Map<string, CorpusArticleRecord[]>,
  bundleCount: number,
  minCorpora = 2,
  maxCorpora = 3,
): MultiCorpusArticleBundle[][] {
  const keywordGroups: Array<{ label: string; keywords: string[] }> = [
    { label: 'responsabilite', keywords: ['responsabilit', 'dommage', 'réparation', 'reparation'] },
    { label: 'contrat', keywords: ['contrat', 'obligation', 'consentement'] },
    { label: 'consommation', keywords: ['consommateur', 'consommation', 'crédit', 'credit'] },
    { label: 'travail', keywords: ['salari', 'employeur', 'licenciement', 'travail'] },
    { label: 'sanction', keywords: ['sanction', 'peine', 'amende', 'pénal', 'penal'] },
    { label: 'entreprise', keywords: ['société', 'societe', 'entreprise', 'commercial'] },
    { label: 'financier', keywords: ['banque', 'crédit', 'credit', 'financier', 'monétaire', 'monetaire'] },
    { label: 'fraude', keywords: ['fraude', 'escroquerie', 'abus', ' tromperie'] },
  ];

  const bundles: MultiCorpusArticleBundle[][] = [];
  const usedSignatures = new Set<string>();

  for (const group of keywordGroups) {
    const matchingByCorpus = new Map<string, CorpusArticleRecord[]>();

    for (const [corpusId, articles] of articlesByCorpus.entries()) {
      const matches = filterArticlesForQuestionGeneration(articles).filter((article) =>
        group.keywords.some((keyword) =>
          article.content.toLowerCase().includes(keyword.toLowerCase()),
        ),
      );
      if (matches.length > 0) {
        matchingByCorpus.set(corpusId, matches.slice(0, 30));
      }
    }

    const corpusIds = [...matchingByCorpus.keys()].sort();
    if (corpusIds.length < minCorpora) {
      continue;
    }

    for (let i = 0; i < corpusIds.length && bundles.length < bundleCount; i++) {
      for (let j = i + 1; j < corpusIds.length && bundles.length < bundleCount; j++) {
        const selectedCorpusIds = [corpusIds[i]!, corpusIds[j]!];
        if (maxCorpora >= 3 && j + 1 < corpusIds.length && bundles.length % 3 === 2) {
          selectedCorpusIds.push(corpusIds[j + 1]!);
        }

        const bundle: MultiCorpusArticleBundle[] = [];
        for (const corpusId of selectedCorpusIds) {
          const candidates = matchingByCorpus.get(corpusId) ?? [];
          const article = candidates[bundles.length % candidates.length];
          if (!article) {
            continue;
          }
          bundle.push({
            corpusId,
            articleNumber: article.articleNumber,
            content: article.content.slice(0, 1800),
          });
        }

        if (bundle.length < minCorpora) {
          continue;
        }

        const signature = bundle
          .map((entry) => `${entry.corpusId}:${entry.articleNumber}`)
          .sort()
          .join('|');
        if (usedSignatures.has(signature)) {
          continue;
        }
        usedSignatures.add(signature);
        bundles.push(bundle);
      }
    }
  }

  return bundles.slice(0, bundleCount);
}
