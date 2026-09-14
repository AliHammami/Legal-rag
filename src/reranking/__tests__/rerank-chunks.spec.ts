import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OpenAIService } from '../../openai/openai.service.js';
import type { SimilarChunk } from '../../retrieval/types.js';
import { MAX_RERANK_ATTEMPTS, RERANKING_MODEL } from '../constants.js';
import { RerankingError } from '../reranking.error.js';
import { rerankChunks } from '../rerank-chunks.js';

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

function makeValidResponse(chunkIds: string[]) {
  return {
    rankedChunks: chunkIds.map((chunkId) => ({ chunkId })),
  };
}

describe('rerankChunks', () => {
  const chunks = [makeChunk('122-5#0', 0.42), makeChunk('122-6#0', 0.18)];
  let createStructuredChatCompletion: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    createStructuredChatCompletion = vi.fn().mockResolvedValue(
      makeValidResponse(['122-6#0', '122-5#0']),
    );
  });

  it('calls OpenAIService with gpt-5-nano and reorders chunks', async () => {
    const openAIService = {
      createStructuredChatCompletion,
    } as unknown as OpenAIService;

    const results = await rerankChunks(openAIService, QUESTION, chunks, 1);

    expect(createStructuredChatCompletion).toHaveBeenCalledTimes(1);
    expect(createStructuredChatCompletion.mock.calls[0]?.[0]).toMatchObject({
      model: RERANKING_MODEL,
    });

    const messages = createStructuredChatCompletion.mock.calls[0]?.[0].messages;
    expect(messages[1]?.content).toContain(QUESTION);
    expect(messages[1]?.content).toContain('122-5#0');
    expect(messages[1]?.content).toContain('122-6#0');
    expect(messages[0]?.content).toContain('untrusted reference data');
    expect(messages[0]?.content).toContain('You must rank ALL candidate chunks');

    expect(results).toHaveLength(1);
    expect(results[0]?.chunkId).toBe('122-6#0');
    expect(results[0]?.distance).toBe(0.18);
  });

  it('applies topK on the TypeScript side', async () => {
    const openAIService = {
      createStructuredChatCompletion,
    } as unknown as OpenAIService;

    const results = await rerankChunks(openAIService, QUESTION, chunks, 2);
    expect(results.map((item) => item.chunkId)).toEqual(['122-6#0', '122-5#0']);
  });

  it('returns topK from 20 candidates when model ranks all candidates', async () => {
    const twentyChunks = Array.from({ length: 20 }, (_, index) =>
      makeChunk(`${100 + index}-1#0`, index * 0.01),
    );
    const rankedIds = [...twentyChunks].reverse().map((chunk) => chunk.chunkId);
    createStructuredChatCompletion.mockResolvedValue(makeValidResponse(rankedIds));

    const openAIService = {
      createStructuredChatCompletion,
    } as unknown as OpenAIService;

    const results = await rerankChunks(
      openAIService,
      QUESTION,
      twentyChunks,
      5,
    );

    expect(createStructuredChatCompletion).toHaveBeenCalledTimes(1);
    expect(results).toHaveLength(5);
    expect(results.map((item) => item.chunkId)).toEqual(rankedIds.slice(0, 5));
  });

  it('does not call OpenAI for invalid input', async () => {
    const openAIService = {
      createStructuredChatCompletion,
    } as unknown as OpenAIService;

    await expect(rerankChunks(openAIService, '', chunks, 1)).rejects.toThrow(
      RerankingError,
    );
    expect(createStructuredChatCompletion).not.toHaveBeenCalled();
  });

  it('propagates OpenAI errors without retry', async () => {
    const openAIError = new Error('OpenAI unavailable');
    createStructuredChatCompletion.mockRejectedValue(openAIError);
    const openAIService = {
      createStructuredChatCompletion,
    } as unknown as OpenAIService;

    await expect(rerankChunks(openAIService, QUESTION, chunks, 1)).rejects.toBe(
      openAIError,
    );
    expect(createStructuredChatCompletion).toHaveBeenCalledTimes(1);
  });

  it('retries once when duplicate chunkId is returned then succeeds', async () => {
    createStructuredChatCompletion
      .mockResolvedValueOnce(
        makeValidResponse(['122-5#0', '122-5#0']),
      )
      .mockResolvedValueOnce(makeValidResponse(['122-6#0', '122-5#0']));

    const openAIService = {
      createStructuredChatCompletion,
    } as unknown as OpenAIService;

    const results = await rerankChunks(openAIService, QUESTION, chunks, 1);

    expect(createStructuredChatCompletion).toHaveBeenCalledTimes(2);
    expect(createStructuredChatCompletion.mock.calls[1]?.[0].messages[1]?.content).toContain(
      'Your previous ranking response was invalid',
    );
    expect(createStructuredChatCompletion.mock.calls[1]?.[0].messages[1]?.content).toContain(
      'There are exactly 2 candidates',
    );
    expect(results[0]?.chunkId).toBe('122-6#0');
  });

  it('throws after duplicate chunkId persists across both attempts', async () => {
    createStructuredChatCompletion.mockResolvedValue(
      makeValidResponse(['122-5#0', '122-5#0']),
    );

    const openAIService = {
      createStructuredChatCompletion,
    } as unknown as OpenAIService;

    await expect(rerankChunks(openAIService, QUESTION, chunks, 1)).rejects.toThrow(
      RerankingError,
    );
    expect(createStructuredChatCompletion).toHaveBeenCalledTimes(MAX_RERANK_ATTEMPTS);
  });

  it('retries once when response is incomplete then succeeds', async () => {
    createStructuredChatCompletion
      .mockResolvedValueOnce({
        rankedChunks: [{ chunkId: '122-5#0' }],
      })
      .mockResolvedValueOnce(makeValidResponse(['122-6#0', '122-5#0']));

    const openAIService = {
      createStructuredChatCompletion,
    } as unknown as OpenAIService;

    const results = await rerankChunks(openAIService, QUESTION, chunks, 2);
    expect(createStructuredChatCompletion).toHaveBeenCalledTimes(2);
    expect(results.map((item) => item.chunkId)).toEqual(['122-6#0', '122-5#0']);
  });

  it('retries once when unknown chunkId is returned then succeeds', async () => {
    createStructuredChatCompletion
      .mockResolvedValueOnce(
        makeValidResponse(['999-9#0', '122-5#0']),
      )
      .mockResolvedValueOnce(makeValidResponse(['122-6#0', '122-5#0']));

    const openAIService = {
      createStructuredChatCompletion,
    } as unknown as OpenAIService;

    const results = await rerankChunks(openAIService, QUESTION, chunks, 1);
    expect(createStructuredChatCompletion).toHaveBeenCalledTimes(2);
    expect(results[0]?.chunkId).toBe('122-6#0');
  });

  it('never calls OpenAI more than MAX_RERANK_ATTEMPTS times', async () => {
    createStructuredChatCompletion.mockResolvedValue({
      rankedChunks: [{ chunkId: '122-5#0' }],
    });

    const openAIService = {
      createStructuredChatCompletion,
    } as unknown as OpenAIService;

    await expect(rerankChunks(openAIService, QUESTION, chunks, 1)).rejects.toThrow(
      RerankingError,
    );
    expect(createStructuredChatCompletion).toHaveBeenCalledTimes(MAX_RERANK_ATTEMPTS);
  });
});
