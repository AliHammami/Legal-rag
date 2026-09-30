import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { extractMessageContent } from '../langchain/extract-message-content.js';
import { RAG_GENERATION_CHAT_PROMPT } from './langchain/rag-generation-chat-prompt.js';
import { createRagChatModel } from './langchain/create-rag-chat-model.js';
import {
  DEFAULT_RAG_GENERATION_MODEL,
  RAG_GENERATION_MODEL_ENV,
} from './constants.js';
import { GenerationError } from './generation.error.js';

export interface GenerateAnswerInput {
  question: string;
  context: string;
  signal?: AbortSignal;
}

@Injectable()
export class RagGenerationService {
  constructor(
    @Inject(ConfigService) private readonly configService: ConfigService,
  ) {}

  getGenerationModel(): string {
    const configuredModel = this.configService.get<string>(
      RAG_GENERATION_MODEL_ENV,
    );
    return configuredModel?.trim() || DEFAULT_RAG_GENERATION_MODEL;
  }

  async generateAnswer(input: GenerateAnswerInput): Promise<string> {
    const model = this.getGenerationModel();
    if (!model) {
      throw new GenerationError(
        `${RAG_GENERATION_MODEL_ENV} is not configured`,
        'CONFIG_MISSING',
      );
    }

    const apiKey = this.configService.getOrThrow<string>('OPENAI_API_KEY');
    const chatModel = createRagChatModel({ apiKey, model });

    const promptValue = await RAG_GENERATION_CHAT_PROMPT.invoke({
      question: input.question,
      context: input.context,
    });

    try {
      const response = await chatModel.invoke(promptValue, {
        signal: input.signal,
      });
      const content = extractMessageContent(response).trim();
      if (!content) {
        throw new GenerationError(
          'OpenAI returned an empty generation response',
          'RESPONSE_EMPTY',
        );
      }
      return content;
    } catch (error) {
      if (error instanceof GenerationError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.message.includes('empty chat completion')) {
          throw new GenerationError(
            'OpenAI returned an empty generation response',
            'RESPONSE_EMPTY',
            error,
          );
        }

        throw new GenerationError(
          'OpenAI generation request failed',
          'API_ERROR',
          error,
        );
      }

      throw new GenerationError(
        'Unexpected error during OpenAI generation',
        'API_ERROR',
        error,
      );
    }
  }
}
