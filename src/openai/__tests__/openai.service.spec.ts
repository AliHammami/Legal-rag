import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConfigService } from '@nestjs/config';

import * as embedModule from '../../langchain/embed-documents-indexed.js';
import * as structuredModule from '../../langchain/invoke-structured-json-chat.js';
import * as streamModule from '../../langchain/stream-chat-text-deltas.js';
import { OpenAIService } from '../openai.service.js';

describe('OpenAIService (LangChain-backed)', () => {
  let service: OpenAIService;

  beforeEach(() => {
    vi.restoreAllMocks();
    const configService = {
      getOrThrow: vi.fn().mockReturnValue('test-key'),
      get: vi.fn((key: string) => {
        if (key === 'OPENAI_MODEL') return 'gpt-chat-default';
        if (key === 'OPENAI_EMBEDDING_MODEL') return 'text-embedding-3-large';
        return undefined;
      }),
    } as unknown as ConfigService;
    service = new OpenAIService(configService);
  });

  it('createEmbeddings delegates to LangChain embedDocumentsIndexed', async () => {
    vi.spyOn(embedModule, 'embedDocumentsIndexed').mockResolvedValue([
      { index: 0, embedding: [0.1, 0.2] },
    ]);

    const result = await service.createEmbeddings(['hello']);

    expect(embedModule.embedDocumentsIndexed).toHaveBeenCalledOnce();
    expect(result).toEqual([{ index: 0, embedding: [0.1, 0.2] }]);
  });

  it('createStructuredChatCompletion delegates to invokeStructuredJsonChat', async () => {
    vi.spyOn(structuredModule, 'invokeStructuredJsonChat').mockResolvedValue({
      corpusIds: ['code-penal'],
    });

    const result = await service.createStructuredChatCompletion<{
      corpusIds: string[];
    }>({
      model: 'gpt-router',
      messages: [{ role: 'user', content: 'Q' }],
      schemaName: 'test',
      schema: { type: 'object' },
    });

    expect(structuredModule.invokeStructuredJsonChat).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: 'test-key',
        model: 'gpt-router',
        schemaName: 'test',
      }),
    );
    expect(result.corpusIds).toEqual(['code-penal']);
  });

  it('streamChatCompletion yields deltas from streamChatTextDeltas', async () => {
    async function* mockStream() {
      yield 'Hello';
      yield ' world';
    }
    vi.spyOn(streamModule, 'streamChatTextDeltas').mockReturnValue(
      mockStream() as ReturnType<typeof streamModule.streamChatTextDeltas>,
    );

    const chunks: string[] = [];
    for await (const delta of service.streamChatCompletion([
      { role: 'user', content: 'Hi' },
    ])) {
      chunks.push(delta);
    }

    expect(chunks.join('')).toBe('Hello world');
    expect(streamModule.streamChatTextDeltas).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gpt-chat-default' }),
    );
  });
});
