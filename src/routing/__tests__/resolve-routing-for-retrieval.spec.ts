import { describe, expect, it } from 'vitest';

import {
  routingMetadataFromExplicitCorpusIds,
  routingMetadataFromRouterResult,
} from '../resolve-routing-for-retrieval.js';

describe('resolve routing for retrieval helpers', () => {
  it('maps non-empty router corpusIds to routed retrieval', () => {
    expect(routingMetadataFromRouterResult({ corpusIds: ['code-penal'] })).toEqual({
      corpusIds: ['code-penal'],
      decision: 'routed',
      fallbackToGlobal: false,
    });
  });

  it('maps empty router corpusIds to abstain', () => {
    expect(routingMetadataFromRouterResult({ corpusIds: [] })).toEqual({
      corpusIds: [],
      decision: 'abstain',
      fallbackToGlobal: false,
    });
  });

  it('maps explicit non-empty corpusIds to routed retrieval', () => {
    expect(
      routingMetadataFromExplicitCorpusIds(['code-penal', 'code-civil']),
    ).toEqual({
      corpusIds: ['code-penal', 'code-civil'],
      decision: 'routed',
      fallbackToGlobal: false,
    });
  });

  it('maps explicit empty corpusIds to global fallback', () => {
    expect(routingMetadataFromExplicitCorpusIds([])).toEqual({
      corpusIds: [],
      decision: 'global_fallback',
      fallbackToGlobal: true,
    });
  });
});
