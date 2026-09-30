import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { OpenAIService } from '../openai/openai.service.js';
import { buildE2EJudgePromptInput } from './build-e2e-judge-messages.js';
import { E2E_JUDGE_CHAT_PROMPT } from './langchain/e2e-judge-chat-prompt.js';
import {
  DEFAULT_RAG_EVALUATION_JUDGE_MODEL,
  E2E_JUDGE_RESPONSE_SCHEMA,
  RAG_EVALUATION_JUDGE_MODEL_ENV,
} from './e2e-judge.constants.js';
import { EvaluationError } from './evaluation.error.js';
import type { E2EJudgeInput, E2EJudgeResult } from './e2e-judge.types.js';
import {
  parseE2EJudgeScoreSnapshot,
  toE2EJudgeResult,
} from './parse-e2e-judge-response.js';

@Injectable()
export class E2EJudgeService {
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

  async judgeQuestion(input: E2EJudgeInput): Promise<E2EJudgeResult> {
    const model = this.getJudgeModel();
    if (!model) {
      throw new EvaluationError(
        `${RAG_EVALUATION_JUDGE_MODEL_ENV} is not configured`,
        'CONFIG_MISSING',
      );
    }

    const promptValue = await E2E_JUDGE_CHAT_PROMPT.invoke(
      buildE2EJudgePromptInput(input),
    );

    try {
      const rawResponse =
        await this.openAIService.createStructuredChatCompletion<unknown>({
          model,
          promptValue,
          schemaName: 'e2e_judge_result',
          schema: E2E_JUDGE_RESPONSE_SCHEMA,
        });

      const snapshot = parseE2EJudgeScoreSnapshot(
        rawResponse,
        input.questionId,
      );

      return toE2EJudgeResult(input.questionId, snapshot);
    } catch (error) {
      if (error instanceof EvaluationError) {
        throw error;
      }

      if (error instanceof Error) {
        const detail = error.message.trim();
        throw new EvaluationError(
          detail.length > 0
            ? `Judge request failed for question ${input.questionId}: ${detail}`
            : `Judge request failed for question ${input.questionId}`,
          'JUDGE_API_ERROR',
          error,
        );
      }

      throw new EvaluationError(
        `Unexpected judge error for question ${input.questionId}`,
        'JUDGE_API_ERROR',
        error,
      );
    }
  }
}
