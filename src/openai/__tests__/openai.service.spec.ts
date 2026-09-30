import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConfigService } from '@nestjs/config';

import * as embedModule from '../../langchain/embed-documents-indexed.js';
import * as chatModelModule from '../../langchain/create-chat-openai.js';
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

  it('createChatModel delegates to createChatOpenAI with api key and model', () => {
    vi.spyOn(chatModelModule, 'createChatOpenAI').mockReturnValue(
      {} as ReturnType<typeof chatModelModule.createChatOpenAI>,
    );

    service.createChatModel('gpt-router');

    expect(chatModelModule.createChatOpenAI).toHaveBeenCalledWith({
      apiKey: 'test-key',
      model: 'gpt-router',
    });
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
