import { describe, expect, it } from 'vitest';

import type { SimilarChunk } from '../../retrieval/types.js';
import type { RerankedChunk } from '../../reranking/types.js';
import {
  collectPipelineChunksByArticle,
  findCandidateIndex,
  formatArticlesFullContentDebug,
  formatJinaInputDebug,
  formatJinaRankingDebug,
  formatRetrievalDebugReport,
  formatVectorSearchDebug,
} from '../format-retrieval-debug.js';

function makeChunk(
  chunkId: string,
  distance: number,
  content?: string,
): SimilarChunk {
  const articleNumber = chunkId.split('#')[0] ?? chunkId;

  return {
    chunkId,
    articleNumber,
    content: content ?? `Content for ${chunkId}`,
    distance,
    metadata: {
      articleNumber,
      pageStart: 1,
      pageEnd: 1,
      source: 'data/code-penal.pdf',
      sourceType: 'pdf',
      chunkIndex: 0,
      chunkCount: 1,
      unitStart: 0,
      unitEnd: 0,
      unitCount: 1,
    },
  };
}

function makeReranked(
  chunkId: string,
  distance: number,
  rerankScore: number,
): RerankedChunk {
  return {
    ...makeChunk(chunkId, distance),
    rerankScore,
  };
}

describe('formatVectorSearchDebug', () => {
  it('formats empty results', () => {
    expect(formatVectorSearchDebug([])).toContain('(aucun résultat)');
  });

  it('formats position, ids, distance, and preview', () => {
    const report = formatVectorSearchDebug(
      [makeChunk('122-6#0', 0.1234, 'A'.repeat(350))],
      300,
    );

    expect(report).toContain('Top 20 vector search');
    expect(report).toContain('#1  article=122-6  chunk=122-6#0  distance=0.1234');
    expect(report).toContain(`"${'A'.repeat(300)}...`);
    expect(report).not.toContain('rerankScore');
  });
});

describe('formatJinaInputDebug', () => {
  it('preserves candidate input order with index', () => {
    const report = formatJinaInputDebug([
      makeChunk('122-6#0', 0.1),
      makeChunk('122-5#0', 0.2),
    ]);

    expect(report).toContain('Candidats envoyés à Jina');
    expect(report).toContain('index=0  article=122-6  chunk=122-6#0');
    expect(report).toContain('index=1  article=122-5  chunk=122-5#0');
  });
});

describe('formatJinaRankingDebug', () => {
  it('formats Jina rank, candidate index, and score', () => {
    const candidates = [
      makeChunk('122-6#0', 0.1),
      makeChunk('122-5#0', 0.2),
      makeChunk('462-9#0', 0.3),
    ];
    const reranked = [
      makeReranked('122-6#0', 0.1, 0.2965),
      makeReranked('122-5#0', 0.2, 0.1197),
      makeReranked('462-9#0', 0.3, 0.0591),
    ];

    const report = formatJinaRankingDebug(candidates, reranked);

    expect(report).toContain('Jina ranking');
    expect(report).toContain(
      '#1  index=0  article=122-6  chunk=122-6#0  score=0.2965',
    );
    expect(report).toContain(
      '#2  index=1  article=122-5  chunk=122-5#0  score=0.1197',
    );
    expect(report).toContain(
      '#3  index=2  article=462-9  chunk=462-9#0  score=0.0591',
    );
  });
});

describe('formatArticlesFullContentDebug', () => {
  it('prints full content for available articles and marks missing ones', () => {
    const candidates = [makeChunk('122-5#0', 0.1, 'Contenu 122-5')];
    const reranked = [makeReranked('462-9#0', 0.2, 0.5)];

    reranked[0]!.content = 'Contenu 462-9';

    const report = formatArticlesFullContentDebug(candidates, reranked, [
      '122-5',
      '122-7',
      '462-9',
    ]);

    expect(report).toContain('--- Article 122-5 ---');
    expect(report).toContain('Contenu 122-5');
    expect(report).toContain('--- Article 122-7 ---');
    expect(report).toContain('(absent des résultats du pipeline)');
    expect(report).toContain('--- Article 462-9 ---');
    expect(report).toContain('Contenu 462-9');
  });
});

describe('formatRetrievalDebugReport', () => {
  it('combines all debug sections', () => {
    const candidates = [makeChunk('122-6#0', 0.1)];
    const reranked = [makeReranked('122-6#0', 0.1, 0.9)];

    const report = formatRetrievalDebugReport({ candidates, reranked });

    expect(report).toContain('Top 20 vector search');
    expect(report).toContain('Candidats envoyés à Jina');
    expect(report).toContain('Jina ranking');
    expect(report).toContain("Contenu complet (articles d'intérêt)");
  });
});

describe('findCandidateIndex', () => {
  it('returns the index of the matching chunkId', () => {
    const candidates = [makeChunk('122-6#0', 0.1), makeChunk('122-5#0', 0.2)];

    expect(findCandidateIndex(candidates, '122-5#0')).toBe(1);
    expect(findCandidateIndex(candidates, 'missing#0')).toBe(-1);
  });
});

describe('collectPipelineChunksByArticle', () => {
  it('merges candidates and reranked chunks by article number', () => {
    const candidates = [makeChunk('122-5#0', 0.1)];
    const reranked = [makeReranked('462-9#0', 0.2, 0.5)];

    const byArticle = collectPipelineChunksByArticle(candidates, reranked);

    expect(byArticle.get('122-5')?.chunkId).toBe('122-5#0');
    expect(byArticle.get('462-9')?.chunkId).toBe('462-9#0');
  });
});
