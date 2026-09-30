import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

import { DEFAULT_EMBEDDING_MODEL } from '../embeddings/constants.js';
import { createOpenAIEmbeddings } from '../langchain/create-openai-embeddings.js';
import { embedDocumentsIndexed } from '../langchain/embed-documents-indexed.js';
import { invokeStructuredJsonChat } from '../langchain/invoke-structured-json-chat.js';
import { streamChatTextDeltas } from '../langchain/stream-chat-text-deltas.js';
import type { CreateEmbeddingsResult } from '../langchain/types.js';

export type {
  CreateEmbeddingsResult,
} from '../langchain/types.js';

export interface CreateChatCompletionOptions {
  model: string;
  messages: ChatCompletionMessageParam[];
  signal?: AbortSignal;
}

export interface CreateStructuredChatCompletionOptions {
  model: string;
  messages: ChatCompletionMessageParam[];
  schemaName: string;
  schema: Record<string, unknown>;
  signal?: AbortSignal;
}

/**
 * Façade NestJS : expose les mêmes méthodes qu'avant, implémentées via LangChain Models.
 */
@Injectable()
export class OpenAIService {
  private readonly apiKey: string;
  private readonly defaultChatModel: string;
  private readonly embeddingModel: string;

  constructor(@Inject(ConfigService) configService: ConfigService) {
    this.apiKey = configService.getOrThrow<string>('OPENAI_API_KEY');
    this.defaultChatModel =
      configService.get<string>('OPENAI_MODEL') ?? 'gpt-5.6-luna';
    this.embeddingModel =
      configService.get<string>('OPENAI_EMBEDDING_MODEL') ??
      DEFAULT_EMBEDDING_MODEL;
  }

  getEmbeddingModel(): string {
    return this.embeddingModel;
  }

  async createEmbeddings(
    inputs: string[],
    _options?: { signal?: AbortSignal },
  ): Promise<CreateEmbeddingsResult[]> {
    const embeddings = createOpenAIEmbeddings({
      apiKey: this.apiKey,
      model: this.embeddingModel,
    });
    // LangChain OpenAIEmbeddings n'expose pas encore signal par appel comme le SDK ;
    // les appels existants du projet n'utilisent presque jamais signal sur embeddings.
    return embedDocumentsIndexed(embeddings, inputs);
  }

  async createStructuredChatCompletion<T>(
    options: CreateStructuredChatCompletionOptions,
  ): Promise<T> {
    return invokeStructuredJsonChat<T>({
      apiKey: this.apiKey,
      model: options.model,
      messages: options.messages,
      schemaName: options.schemaName,
      schema: options.schema,
      signal: options.signal,
    });
  }

  async *streamChatCompletion(
    messages: ChatCompletionMessageParam[],
    signal?: AbortSignal,
  ): AsyncGenerator<string> {
    yield* streamChatTextDeltas({
      apiKey: this.apiKey,
      model: this.defaultChatModel,
      messages,
      signal,
    });
  }
}
