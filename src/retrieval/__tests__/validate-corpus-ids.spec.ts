import { describe, expect, it } from 'vitest';

import { RetrievalError } from '../retrieval.error.js';
import { validateCorpusIds } from '../validate-corpus-ids.js';

describe('validateCorpusIds', () => {
  it('returns undefined when corpusIds is absent', () => {
    expect(validateCorpusIds(undefined)).toBeUndefined();
  });

  it('rejects an empty corpusIds array', () => {
    expect(() => validateCorpusIds([])).toThrow(RetrievalError);
    expect(() => validateCorpusIds([])).toThrow(/must not be empty/);
  });

  it('accepts a known single corpus', () => {
    expect(validateCorpusIds(['code-penal'])).toEqual(['code-penal']);
  });

  it('normalizes duplicate corpusIds', () => {
    expect(
      validateCorpusIds(['code-civil', 'code-civil', 'code-du-travail']),
    ).toEqual(['code-civil', 'code-du-travail']);
  });

  it('rejects an unknown corpus', () => {
    expect(() => validateCorpusIds(['corpus-inconnu'])).toThrow(RetrievalError);
    expect(() => validateCorpusIds(['corpus-inconnu'])).toThrow(/Corpus inconnu/);
  });
});
