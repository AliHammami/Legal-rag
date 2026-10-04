import { Injectable } from '@nestjs/common';

import { answerQuestion } from '../generation/answer-question.js';
import { RagGenerationService } from '../generation/rag-generation.service.js';
import { OpenAIErrorMapper } from '../openai/openai-error.mapper.js';
import { OpenAIService } from '../openai/openai.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { JinaRerankerService } from '../reranking/jina-reranker.service.js';
import { mapPipelineErrorToHttpException } from './map-pipeline-error-to-http.js';
import type { RagAnswerResponse } from './rag-answer-response.types.js';
import { toRagAnswerResponse } from './to-rag-answer-response.js';

@Injectable()
export class RagService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly openAIService: OpenAIService,
    private readonly rerankerService: JinaRerankerService,
    private readonly generationService: RagGenerationService,
    private readonly openAIErrorMapper: OpenAIErrorMapper,
  ) {}

  async answer(question: string): Promise<RagAnswerResponse> {
    try {
      const result = await answerQuestion(
        this.prisma,
        this.openAIService,
        this.rerankerService,
        this.generationService,
        question,
      );

      return toRagAnswerResponse(result);
    } catch (error) {
      throw mapPipelineErrorToHttpException(error, this.openAIErrorMapper);
    }
  }
}
