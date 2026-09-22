import { describe, expect, it } from 'vitest';

import {
  analyzeCompetitors,
  classifyGoldLossCause,
  goldChunkStatsFromChunks,
  inferChunkingSignals,
  summarizeCauseMatrix,
} from '../multicorpus/retrieval-diagnostic.js';

describe('retrieval-diagnostic', () => {
  it('detects same-corpus wrong article competitors', () => {
    const analysis = analyzeCompetitors({
      gold: { corpusId: 'code-du-commerce', articleNumber: 'L123-8' },
      retrieval: [
        {
          chunkId: '9-1#0',
          corpusId: 'code-civil',
          articleNumber: '9-1',
          retrievalDistance: 0.1,
          retrievalRank: 1,
        },
        {
          chunkId: 'L123-3#0',
          corpusId: 'code-du-commerce',
          articleNumber: 'L123-3',
          retrievalDistance: 0.2,
          retrievalRank: 2,
        },
      ],
      rerank: [],
      routedCorpusIds: ['code-civil', 'code-du-commerce'],
    });

    expect(analysis.pattern).toBe('A_same_corpus_wrong_article');
    expect(analysis.sameCorpusAlternatives).toContain(
      'code-du-commerce:L123-3',
    );
  });

  it('classifies reranking and filter stages separately from retrieval', () => {
    expect(
      classifyGoldLossCause({
        pipelineStage: 'R1',
        competitor: analyzeCompetitors({
          gold: { corpusId: 'code-penal', articleNumber: '1' },
          retrieval: [],
          rerank: [],
          routedCorpusIds: ['code-penal'],
        }),
        chunkingSignals: [],
      }),
    ).toBe('reranking');

    expect(
      classifyGoldLossCause({
        pipelineStage: 'R2',
        competitor: analyzeCompetitors({
          gold: { corpusId: 'code-penal', articleNumber: '1' },
          retrieval: [],
          rerank: [],
          routedCorpusIds: ['code-penal'],
        }),
        chunkingSignals: [],
      }),
    ).toBe('filter');
  });

  it('summarizes cause matrix counts', () => {
    const matrix = summarizeCauseMatrix([
      {
        questionId: 'q1',
        question: 'q',
        gold: { corpusId: 'c', articleNumber: '1' },
        pipelineStage: 'R0',
        causeCategory: 'semantic_mismatch',
        competitor: analyzeCompetitors({
          gold: { corpusId: 'c', articleNumber: '1' },
          retrieval: [],
          rerank: [],
          routedCorpusIds: ['c'],
        }),
        goldChunkStats: null,
        chunkingSignals: [],
      },
      {
        questionId: 'q2',
        question: 'q',
        gold: { corpusId: 'c', articleNumber: '2' },
        pipelineStage: 'R4',
        causeCategory: 'indeterminate',
        competitor: analyzeCompetitors({
          gold: { corpusId: 'c', articleNumber: '2' },
          retrieval: [],
          rerank: [],
          routedCorpusIds: ['c'],
        }),
        goldChunkStats: null,
        chunkingSignals: [],
      },
    ]);

    expect(matrix.find((row) => row.category === 'semantic_mismatch')?.count).toBe(
      1,
    );
    expect(matrix.find((row) => row.category === 'indeterminate')?.count).toBe(1);
  });

  it('flags multi-chunk chunking signals', () => {
    const stats = goldChunkStatsFromChunks(
      { corpusId: 'code-penal', articleNumber: 'x' },
      [
        {
          chunkId: 'x#0',
          articleNumber: 'x',
          content: 'a'.repeat(1600),
          charCount: 1600,
          metadata: {} as never,
        },
        {
          chunkId: 'x#1',
          articleNumber: 'x',
          content: 'b'.repeat(1600),
          charCount: 1600,
          metadata: {} as never,
        },
      ],
    );
    expect(inferChunkingSignals(stats)).toContain('information-split-across-chunks');
  });
});
