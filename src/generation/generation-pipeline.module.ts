import { Module } from '@nestjs/common';

import { RerankingPipelineModule } from '../reranking/reranking-pipeline.module.js';
import { RagGenerationService } from './rag-generation.service.js';

@Module({
  imports: [RerankingPipelineModule],
  providers: [RagGenerationService],
  exports: [RagGenerationService, RerankingPipelineModule],
})
export class GenerationPipelineModule {}
