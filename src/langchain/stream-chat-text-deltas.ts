import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

import { createChatOpenAI } from './create-chat-openai.js';
import { openAiChatMessagesToLangChain } from './openai-chat-messages-to-langchain.js';

export async function* streamChatTextDeltas(
  options: {
    apiKey: string;
    model: string;
    messages: ChatCompletionMessageParam[];
    signal?: AbortSignal;
  },
): AsyncGenerator<string> {
  const model = createChatOpenAI({
    apiKey: options.apiKey,
    model: options.model,
  });
  const messages = openAiChatMessagesToLangChain(options.messages);
  const stream = await model.stream(messages, { signal: options.signal });

  for await (const chunk of stream) {
    const delta =
      typeof chunk.content === 'string'
        ? chunk.content
        : Array.isArray(chunk.content)
          ? chunk.content
              .map((part) =>
                typeof part === 'string'
                  ? part
                  : part && typeof part === 'object' && 'text' in part
                    ? String(part.text)
                    : '',
              )
              .join('')
          : '';
    if (delta) {
      yield delta;
    }
  }
}
