import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  type BaseMessage,
} from '@langchain/core/messages';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

export function openAiChatMessagesToLangChain(
  messages: ChatCompletionMessageParam[],
): BaseMessage[] {
  return messages.map((message) => {
    const content =
      typeof message.content === 'string'
        ? message.content
        : JSON.stringify(message.content);

    switch (message.role) {
      case 'system':
        return new SystemMessage(content);
      case 'assistant':
        return new AIMessage(content);
      case 'user':
      default:
        return new HumanMessage(content);
    }
  });
}
