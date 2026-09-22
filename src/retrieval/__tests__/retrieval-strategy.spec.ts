import { describe, expect, it } from 'vitest';

import {
  DEFAULT_RETRIEVAL_STRATEGY,
  parseRetrievalStrategy,
  resolveRetrievalStrategy,
} from '../retrieval-strategy.js';

describe('retrieval-strategy', () => {
  it('defaults to vector', () => {
    expect(DEFAULT_RETRIEVAL_STRATEGY).toBe('vector');
    expect(parseRetrievalStrategy(undefined)).toBe('vector');
    expect(resolveRetrievalStrategy({})).toBe('vector');
  });

  it('parses hybrid-union', () => {
    expect(parseRetrievalStrategy('hybrid-union')).toBe('hybrid-union');
  });

  it('rejects unknown strategy', () => {
    expect(() => parseRetrievalStrategy('rrf')).toThrow(/Invalid/);
  });
});
