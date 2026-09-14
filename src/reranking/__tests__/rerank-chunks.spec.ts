import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPipelineProfiling } from '../../profiling/pipeline-timings.js';
import type { SimilarChunk } from '../../retrieval/types.js';
import { rerankChunks } from '../rerank-chunks.js';
import type { RerankerService } from '../reranker.service.js';

const QUESTION = 'Quelles sont les conditions de la légitime défense ?';

function makeChunk(chunkId: string, distance: number): SimilarChunk {
  return {
    chunkId,
    articleNumber: chunkId.split('#')[0] ?? chunkId,
    content: `Content for ${chunkId}`,
    metadata: {
      articleNumber: chunkId.split('#')[0] ?? chunkId,
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
    distance,
  };
}

describe('rerankChunks', () => {
  const chunks = [makeChunk('122-5#0', 0.42), makeChunk('122-6#0', 0.18)];
  let rerank: ReturnType<typeof vi.fn>;
  let rerankerService: RerankerService;

  beforeEach(() => {
    rerank = vi.fn().mockResolvedValue([
      { chunkId: '122-6#0', score: 0.98 },
      { chunkId: '122-5#0', score: 0.94 },
    ]);
    rerankerService = { rerank };
  });

  it('delegates to reranker with topN and maps results', async () => {
    rerank.mockResolvedValueOnce([{ chunkId: '122-6#0', score: 0.98 }]);

    const results = await rerankChunks(rerankerService, QUESTION, chunks, 1);

    expect(rerank).toHaveBeenCalledWith(
      QUESTION,
      [
        { chunkId: '122-5#0', content: 'Content for 122-5#0' },
        { chunkId: '122-6#0', content: 'Content for 122-6#0' },
      ],
      { topN: 1 },
    );
    expect(results).toHaveLength(1);
    expect(results[0]?.chunkId).toBe('122-6#0');
    expect(results[0]?.distance).toBe(0.18);
    expect(results[0]?.rerankScore).toBe(0.98);
  });

  it('records profiling metrics', async () => {
    const profiling = createPipelineProfiling();

    await rerankChunks(rerankerService, QUESTION, chunks, 2, { profiling });

    expect(profiling.jinaRerankingMs).toBeGreaterThanOrEqual(0);
    expect(profiling.mappingMs).toBeGreaterThanOrEqual(0);
    expect(profiling.rerankingCalls).toBe(1);
  });
});
