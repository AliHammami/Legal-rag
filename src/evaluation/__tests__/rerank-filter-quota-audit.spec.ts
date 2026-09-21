import { describe, expect, it } from 'vitest';

import {
  buildFilterAuditDetails,
  buildQuestionQuotaAuditRecord,
  classifyByCorpusPresence,
  evaluateThresholdGridRow,
  simulateMinOneChunkPerRoutedCorpus,
  toRerankedChunksFromPersisted,
} from '../multicorpus/rerank-filter-quota-audit.js';

describe('rerank-filter-quota-audit', () => {
  it('classifies routed corpus coverage A/B/C', () => {
    expect(classifyByCorpusPresence(['a', 'b'], 2, 2, 2)).toBe('A');
    expect(classifyByCorpusPresence(['a', 'b'], 2, 1, 1)).toBe('B');
    expect(classifyByCorpusPresence(['a', 'b'], 2, 2, 1)).toBe('C');
  });

  it('builds filter audit rows using production filter semantics', () => {
    const rerank = toRerankedChunksFromPersisted([
      {
        chunkId: 'a#0',
        corpusId: 'code-a',
        articleNumber: '1',
        rerankScore: 0.8,
        rerankRank: 1,
      },
      {
        chunkId: 'b#0',
        corpusId: 'code-b',
        articleNumber: '2',
        rerankScore: 0.2,
        rerankRank: 2,
      },
    ]);

    const details = buildFilterAuditDetails(rerank, 0.4);

    expect(details.chunks).toHaveLength(2);
    expect(details.chunks[0]).toMatchObject({ kept: true, relativeScore: 1 });
    expect(details.chunks[1]).toMatchObject({ kept: false, relativeScore: 0.25 });
    expect(details.kept).toHaveLength(1);
  });

  it('builds a full question audit record', () => {
    const record = buildQuestionQuotaAuditRecord({
      questionId: 'q353',
      question: 'Test question',
      routedCorpusIds: ['code-civil', 'code-du-travail'],
      goldArticles: [
        { corpusId: 'code-civil', articleNumber: '10' },
        { corpusId: 'code-du-travail', articleNumber: 'L1237-3' },
      ],
      retrieval: [
        {
          chunkId: 'civil#0',
          corpusId: 'code-civil',
          articleNumber: '10',
          retrievalDistance: 0.1,
          retrievalRank: 1,
        },
        {
          chunkId: 'travail#0',
          corpusId: 'code-du-travail',
          articleNumber: 'L1237-3',
          retrievalDistance: 0.2,
          retrievalRank: 2,
        },
      ],
      rerank: [
        {
          chunkId: 'travail#0',
          corpusId: 'code-du-travail',
          articleNumber: 'L1237-3',
          rerankScore: 0.71,
          rerankRank: 1,
        },
        {
          chunkId: 'civil#0',
          corpusId: 'code-civil',
          articleNumber: '10',
          rerankScore: 0.11,
          rerankRank: 2,
        },
      ],
    });

    expect(record.classification.byRoutedCorpus).toBe('C');
    expect(record.coverage.rerank.goldArticleHitCount).toBe(2);
    expect(record.coverage.filter.goldArticleHitCount).toBe(1);
    expect(record.filter.chunks[1]?.kept).toBe(false);
  });

  it('simulates min-one chunk per routed corpus after threshold filter', () => {
    const rerank = toRerankedChunksFromPersisted([
      {
        chunkId: 'a#0',
        corpusId: 'code-a',
        articleNumber: '1',
        rerankScore: 0.9,
        rerankRank: 1,
      },
      {
        chunkId: 'b#0',
        corpusId: 'code-b',
        articleNumber: '2',
        rerankScore: 0.1,
        rerankRank: 2,
      },
    ]);

    const filtered = simulateMinOneChunkPerRoutedCorpus(
      rerank,
      ['code-a', 'code-b'],
      0.4,
    );

    expect(filtered).toHaveLength(2);
    expect(filtered.map((chunk) => chunk.corpusId).sort()).toEqual([
      'code-a',
      'code-b',
    ]);
  });

  it('evaluates threshold grid row offline from persisted rerank scores', () => {
    const record = buildQuestionQuotaAuditRecord({
      questionId: 'q1',
      question: 'Q',
      routedCorpusIds: ['code-a', 'code-b'],
      goldArticles: [
        { corpusId: 'code-a', articleNumber: '1' },
        { corpusId: 'code-b', articleNumber: '2' },
      ],
      retrieval: [],
      rerank: [
        {
          chunkId: 'a#0',
          corpusId: 'code-a',
          articleNumber: '1',
          rerankScore: 0.9,
          rerankRank: 1,
        },
        {
          chunkId: 'b#0',
          corpusId: 'code-b',
          articleNumber: '2',
          rerankScore: 0.25,
          rerankRank: 2,
        },
      ],
    });

    const row040 = evaluateThresholdGridRow([record], 0.4, 'standard');
    const row025 = evaluateThresholdGridRow([record], 0.25, 'standard');
    const row025Min = evaluateThresholdGridRow(
      [record],
      0.25,
      'minOnePerRoutedCorpus',
    );

    expect(row040.twoRoutedCorpora).toBe(0);
    expect(row025.twoRoutedCorpora).toBe(1);
    expect(row025Min.twoRoutedCorpora).toBe(1);
    expect(row025Min.averageChunksKept).toBe(2);
  });
});
