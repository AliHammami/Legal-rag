import { describe, expect, it } from 'vitest';

import {
  classifyMissingGoldArticle,
  type GoldArticleLossDetail,
} from '../multicorpus/context-loss-forensic-audit.js';

describe('context-loss-forensic-audit', () => {
  const gold = { corpusId: 'code-penal', articleNumber: '222-1' };
  const retrieval = [
    {
      chunkId: '222-1#0',
      corpusId: 'code-penal',
      articleNumber: '222-1',
      retrievalDistance: 0.1,
      retrievalRank: 3,
    },
    {
      chunkId: '222-3#0',
      corpusId: 'code-penal',
      articleNumber: '222-3',
      retrievalDistance: 0.2,
      retrievalRank: 1,
    },
  ];
  const rerank = [
    {
      chunkId: '222-3#0',
      corpusId: 'code-penal',
      articleNumber: '222-3',
      rerankScore: 0.9,
      rerankRank: 1,
    },
    {
      chunkId: '222-4#0',
      corpusId: 'code-penal',
      articleNumber: '222-4',
      rerankScore: 0.5,
      rerankRank: 2,
    },
  ];

  it('classifies R0 when gold absent from retrieval', () => {
    const loss: GoldArticleLossDetail = classifyMissingGoldArticle({
      gold,
      retrieval: [],
      rerank: [],
      filtered: [],
      finalSources: [],
    });
    expect(loss.reason).toBe('R0');
  });

  it('classifies R1 when gold in retrieval but not rerank top5', () => {
    const loss = classifyMissingGoldArticle({
      gold,
      retrieval,
      rerank,
      filtered: [],
      finalSources: [],
    });
    expect(loss.reason).toBe('R1');
    expect(loss.retrievalRank).toBe(3);
  });

  it('classifies R2 when gold in rerank but filtered out', () => {
    const rerankWithGold = [
      ...rerank,
      {
        chunkId: '222-1#0',
        corpusId: 'code-penal',
        articleNumber: '222-1',
        rerankScore: 0.01,
        rerankRank: 5,
      },
    ];
    const filtered = rerankWithGold.filter((chunk) => chunk.articleNumber !== '222-1');
    const loss = classifyMissingGoldArticle({
      gold,
      retrieval,
      rerank: rerankWithGold,
      filtered,
      finalSources: [],
    });
    expect(loss.reason).toBe('R2');
  });

  it('classifies R4 without pipeline artefacts', () => {
    const loss = classifyMissingGoldArticle({
      gold,
      finalSources: [],
    });
    expect(loss.reason).toBe('R4');
  });
});
