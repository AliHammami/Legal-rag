import { describe, expect, it } from 'vitest';

import { loadMulticorpusCorpusArticleRegistry } from '../load-corpus-article-index.js';
import {
  reconcileQuestionGoldArticles,
  validateGoldCorpusArticleConsistency,
} from '../reconcile-multicorpus-gold-articles.js';
import { FIXTURE_MULTICORPUS_QUESTIONS } from './fixtures/multicorpus-dataset.fixture.js';

describe('reconcileMulticorpusGoldArticles', () => {
  it('maps single-corpus gold articles to the declared corpus', async () => {
    const registry = await loadMulticorpusCorpusArticleRegistry();
    const question = FIXTURE_MULTICORPUS_QUESTIONS[0]!;
    const result = reconcileQuestionGoldArticles(
      {
        ...question,
        goldArticles: question.goldArticles.map((article) => article.articleNumber),
      } as typeof question & { goldArticles: string[] },
      registry,
    );

    expect(result.unresolved).toBe(false);
    expect(result.resolved[0]).toEqual({
      corpusId: 'code-penal',
      articleNumber: '122-5',
    });
  });

  it('validates corpus/article consistency on mapped fixtures', () => {
    for (const question of FIXTURE_MULTICORPUS_QUESTIONS) {
      expect(validateGoldCorpusArticleConsistency(question)).toEqual([]);
    }
  });
});
