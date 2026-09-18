import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OpenAIModule } from '../openai/openai.module.js';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), OpenAIModule],
})
export class RoutingPipelineModule {}
