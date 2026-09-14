import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OpenAIModule } from '../openai/openai.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { JinaRerankerService } from './jina-reranker.service.js';
import { RERANKER_SERVICE } from './reranker.service.js';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, OpenAIModule],
  providers: [
    JinaRerankerService,
    {
      provide: RERANKER_SERVICE,
      useExisting: JinaRerankerService,
    },
  ],
  exports: [JinaRerankerService, RERANKER_SERVICE],
})
export class RerankingPipelineModule {}
