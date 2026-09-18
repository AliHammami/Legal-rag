import { describe, expect, it } from 'vitest';

import {
  toRetrievalCorpusIds,
  toRoutingMetadata,
} from '../resolve-routing-for-retrieval.js';

describe('resolve routing for retrieval helpers', () => {
  it('maps non-empty corpusIds to filtered retrieval', () => {
    expect(toRetrievalCorpusIds({ corpusIds: ['code-penal'] })).toEqual([
      'code-penal',
    ]);
    expect(toRoutingMetadata({ corpusIds: ['code-penal'] })).toEqual({
      corpusIds: ['code-penal'],
      fallbackToGlobal: false,
    });
  });

  it('maps empty corpusIds to global retrieval', () => {
    expect(toRetrievalCorpusIds({ corpusIds: [] })).toBeUndefined();
    expect(toRoutingMetadata({ corpusIds: [] })).toEqual({
      corpusIds: [],
      fallbackToGlobal: true,
    });
  });
});
