import { Module } from '@nestjs/common';
import { OpenAIErrorMapper } from './openai-error.mapper.js';
import { OpenAIService } from './openai.service.js';

@Module({
  providers: [OpenAIService, OpenAIErrorMapper],
  exports: [OpenAIService, OpenAIErrorMapper],
})
export class OpenAIModule {}
