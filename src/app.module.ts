import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { ConversationsModule } from './conversations/conversations.module.js';
import { HealthModule } from './health/health.module.js';
import { RagModule } from './rag/rag.module.js';
import { OpenAIModule } from './openai/openai.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    HealthModule,
    OpenAIModule,
    ConversationsModule,
    RagModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
