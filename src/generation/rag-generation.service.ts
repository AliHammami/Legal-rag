import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { OpenAIService } from '../openai/openai.service.js';
import { buildRagMessages } from './build-rag-messages.js';
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
    @Inject(OpenAIService) private readonly openAIService: OpenAIService,
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

    const messages = buildRagMessages(input.question, input.context);

    try {
      return await this.openAIService.createChatCompletion({
        model,
        messages,
        signal: input.signal,
      });
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
