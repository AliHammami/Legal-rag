import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { OpenAIModule } from '../openai/openai.module.js';
import { E2ESourceJudgeService } from './e2e-source-judge.service.js';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), OpenAIModule],
  providers: [E2ESourceJudgeService],
  exports: [E2ESourceJudgeService],
})
export class E2ESourceJudgeModule {}
