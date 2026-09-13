import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

@Injectable()
export class OpenAIService {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(configService: ConfigService) {
    const apiKey = configService.getOrThrow<string>('OPENAI_API_KEY');
    this.client = new OpenAI({ apiKey });
    this.model = configService.get<string>('OPENAI_MODEL') ?? 'gpt-5.6-luna';
  }

  async *streamChatCompletion(
    messages: ChatCompletionMessageParam[],
    signal?: AbortSignal,
  ): AsyncGenerator<string> {
    const stream = await this.client.chat.completions.create(
      {
        model: this.model,
        messages,
        stream: true,
      },
      { signal },
    );

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        yield content;
      }
    }
  }
}
