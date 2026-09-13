import { Module } from '@nestjs/common';
import { OpenAIModule } from '../openai/openai.module.js';
import { ChatService } from './chat.service.js';
import { ConversationsController } from './conversations.controller.js';

@Module({
  imports: [OpenAIModule],
  controllers: [ConversationsController],
  providers: [ChatService],
})
export class ConversationsModule {}
