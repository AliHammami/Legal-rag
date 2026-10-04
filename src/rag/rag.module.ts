import { Module } from '@nestjs/common';

import { GenerationPipelineModule } from '../generation/generation-pipeline.module.js';
import { OpenAIModule } from '../openai/openai.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { RagController } from './rag.controller.js';
import { RagService } from './rag.service.js';

@Module({
  imports: [PrismaModule, OpenAIModule, GenerationPipelineModule],
  controllers: [RagController],
  providers: [RagService],
})
export class RagModule {}
