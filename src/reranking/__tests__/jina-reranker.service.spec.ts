import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import { JinaRerankerService } from '../jina-reranker.service.js';
import { RerankingError } from '../reranking.error.js';

const documents = [
  { chunkId: '122-5#0', content: 'Article 122-5' },
  { chunkId: '122-6#0', content: 'Article 122-6' },
];

describe('JinaRerankerService', () => {
  let configService: ConfigService;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    configService = {
      get: vi.fn().mockReturnValue('test-jina-key'),
    } as unknown as ConfigService;
    fetchMock = vi.fn();
  });

  it('calls Jina API with query, documents, and top_n', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [
            { index: 1, relevance_score: 0.91 },
            { index: 0, relevance_score: 0.87 },
          ],
        }),
        { status: 200 },
      ),
    );

    const service = new JinaRerankerService(configService, fetchMock);
    const results = await service.rerank('Question ?', documents, { topN: 2 });

    expect(results).toEqual([
      { chunkId: '122-6#0', score: 0.91 },
      { chunkId: '122-5#0', score: 0.87 },
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.jina.ai/v1/rerank');
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer test-jina-key',
      'Content-Type': 'application/json',
    });

    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({
      model: 'jina-reranker-v3.5',
      query: 'Question ?',
      documents: ['Article 122-5', 'Article 122-6'],
      top_n: 2,
      return_documents: false,
    });
  });

  it('throws when JINA_API_KEY is missing', async () => {
    configService = {
      get: vi.fn().mockReturnValue(undefined),
    } as unknown as ConfigService;

    const service = new JinaRerankerService(configService, fetchMock);

    await expect(service.rerank('Question ?', documents)).rejects.toMatchObject({
      name: 'RerankingError',
      code: 'CONFIG_MISSING',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws on HTTP error', async () => {
    fetchMock.mockResolvedValue(new Response('quota exceeded', { status: 429 }));

    const service = new JinaRerankerService(configService, fetchMock);

    await expect(service.rerank('Question ?', documents)).rejects.toMatchObject({
      name: 'RerankingError',
      code: 'API_ERROR',
    });
  });

  it('throws on network error', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));

    const service = new JinaRerankerService(configService, fetchMock);

    await expect(service.rerank('Question ?', documents)).rejects.toMatchObject({
      name: 'RerankingError',
      code: 'NETWORK_ERROR',
    });
  });

  it('throws on invalid JSON response', async () => {
    fetchMock.mockResolvedValue(new Response('not-json', { status: 200 }));

    const service = new JinaRerankerService(configService, fetchMock);

    await expect(service.rerank('Question ?', documents)).rejects.toMatchObject({
      name: 'RerankingError',
      code: 'RESPONSE_INVALID',
    });
  });
});
