import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { OpenAIModule } from '../openai/openai.module.js';
import { E2EJudgeService } from './e2e-judge.service.js';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), OpenAIModule],
  providers: [E2EJudgeService],
  exports: [E2EJudgeService],
})
export class E2EJudgeModule {}
