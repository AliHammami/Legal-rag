import { Module } from '@nestjs/common';

import { OpenAIModule } from '../openai/openai.module.js';
import { RerankingPipelineModule } from '../reranking/reranking-pipeline.module.js';
import { RagGenerationService } from './rag-generation.service.js';

@Module({
  imports: [RerankingPipelineModule, OpenAIModule],
  providers: [RagGenerationService],
  exports: [RagGenerationService, RerankingPipelineModule],
})
export class GenerationPipelineModule {}
