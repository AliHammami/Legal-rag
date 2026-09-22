import { describe, expect, it } from 'vitest';

import {
  DEFAULT_RERANK_TOP_K,
  DEFAULT_RETRIEVAL_TOP_K,
} from '../constants.js';

describe('reranking constants', () => {
  it('uses production retrieval depth validated by top30 regression 2026-09-22', () => {
    expect(DEFAULT_RETRIEVAL_TOP_K).toBe(30);
    expect(DEFAULT_RERANK_TOP_K).toBe(5);
  });
});
