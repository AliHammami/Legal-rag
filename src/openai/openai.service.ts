import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import {
  DEFAULT_EMBEDDING_MODEL,
  EMBEDDING_DIMENSIONS,
} from '../embeddings/constants.js';

export interface CreateEmbeddingsResult {
  index: number;
  embedding: number[];
}

@Injectable()
export class OpenAIService {
  private readonly client: OpenAI;
  private readonly model: string;
  private readonly embeddingModel: string;

  constructor(@Inject(ConfigService) configService: ConfigService) {
    const apiKey = configService.getOrThrow<string>('OPENAI_API_KEY');
    this.client = new OpenAI({ apiKey });
    this.model = configService.get<string>('OPENAI_MODEL') ?? 'gpt-5.6-luna';
    this.embeddingModel =
      configService.get<string>('OPENAI_EMBEDDING_MODEL') ?? DEFAULT_EMBEDDING_MODEL;
  }

  getEmbeddingModel(): string {
    return this.embeddingModel;
  }

  async createEmbeddings(
    inputs: string[],
    options?: { signal?: AbortSignal },
  ): Promise<CreateEmbeddingsResult[]> {
    const response = await this.client.embeddings.create(
      {
        model: this.embeddingModel,
        input: inputs,
        dimensions: EMBEDDING_DIMENSIONS,
        encoding_format: 'float',
      },
      { signal: options?.signal },
    );

    return response.data.map((item) => ({
      index: item.index,
      embedding: item.embedding,
    }));
  }

  async *streamChatCompletion(
    messages: ChatCompletionMessageParam[],
    signal?: AbortSignal,
  ): AsyncGenerator<string> {
    const stream = await this.client.chat.completions.create(
      {
        model: this.model,
        messages,
        stream: true,
      },
      { signal },
    );

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        yield content;
      }
    }
  }
}
