import type { GoldArticle } from './gold-article.js';

/** Manual resolutions for gold articles that cannot be disambiguated automatically. */
export const MULTICORPUS_GOLD_ARTICLE_OVERRIDES: Record<string, GoldArticle[]> = {
  q414: [
    { corpusId: 'code-de-la-consommation', articleNumber: 'L131-1' },
    { corpusId: 'code-du-commerce', articleNumber: 'L123-38' },
  ],
  q416: [
    { corpusId: 'code-de-la-consommation', articleNumber: 'L131-2' },
    { corpusId: 'code-monetaire-et-financier', articleNumber: 'L131-70' },
  ],
};

export const MULTICORPUS_QUESTION_METADATA_OVERRIDES: Record<
  string,
  { goldCorpusIds?: string[]; questionType?: 'single-corpus' | 'multi-corpus' }
> = {
  q414: {
    goldCorpusIds: ['code-de-la-consommation', 'code-du-commerce'],
    questionType: 'multi-corpus',
  },
};
