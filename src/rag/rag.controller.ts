import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';

import { RagAnswerRequestDto } from './dto/rag-answer-request.dto.js';
import type { RagAnswerResponse } from './rag-answer-response.types.js';
import { RagService } from './rag.service.js';

@Controller('rag')
export class RagController {
  constructor(private readonly ragService: RagService) {}

  @Post('answer')
  @HttpCode(HttpStatus.OK)
  answer(@Body() body: RagAnswerRequestDto): Promise<RagAnswerResponse> {
    return this.ragService.answer(body.question);
  }
}
