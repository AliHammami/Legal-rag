import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { OpenAIService } from '../openai/openai.service.js';
import { buildE2ESourceJudgeMessages } from './build-e2e-source-judge-messages.js';
import {
  DEFAULT_RAG_EVALUATION_JUDGE_MODEL,
  RAG_EVALUATION_JUDGE_MODEL_ENV,
} from './e2e-judge.constants.js';
import { E2E_SOURCE_JUDGE_RESPONSE_SCHEMA } from './e2e-source-judge.constants.js';
import { EvaluationError } from './evaluation.error.js';
import type {
  E2ESourceJudgeInput,
  E2ESourceJudgeResult,
} from './e2e-source-judge.types.js';
import { parseE2ESourceJudgeResult } from './parse-e2e-source-judge-response.js';

@Injectable()
export class E2ESourceJudgeService {
  constructor(
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(OpenAIService) private readonly openAIService: OpenAIService,
  ) {}

  getJudgeModel(): string {
    const configuredModel = this.configService.get<string>(
      RAG_EVALUATION_JUDGE_MODEL_ENV,
    );
    return configuredModel?.trim() || DEFAULT_RAG_EVALUATION_JUDGE_MODEL;
  }

  async judgeSources(input: E2ESourceJudgeInput): Promise<E2ESourceJudgeResult> {
    const model = this.getJudgeModel();
    if (!model) {
      throw new EvaluationError(
        `${RAG_EVALUATION_JUDGE_MODEL_ENV} is not configured`,
        'CONFIG_MISSING',
      );
    }

    const messages = buildE2ESourceJudgeMessages(input);

    try {
      const rawResponse =
        await this.openAIService.createStructuredChatCompletion<unknown>({
          model,
          messages,
          schemaName: 'e2e_source_judge_result',
          schema: E2E_SOURCE_JUDGE_RESPONSE_SCHEMA,
        });

      return parseE2ESourceJudgeResult(rawResponse, input.questionId);
    } catch (error) {
      if (error instanceof EvaluationError) {
        throw error;
      }

      if (error instanceof Error) {
        throw new EvaluationError(
          `Source judge request failed for question ${input.questionId}`,
          'SOURCE_JUDGE_API_ERROR',
          error,
        );
      }

      throw new EvaluationError(
        `Unexpected source judge error for question ${input.questionId}`,
        'SOURCE_JUDGE_API_ERROR',
        error,
      );
    }
  }
}
