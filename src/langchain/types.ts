export interface CreateEmbeddingsResult {
  index: number;
  embedding: number[];
}

import type { BasePromptValueInterface } from '@langchain/core/prompt_values';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

export interface StructuredJsonChatInvokeOptions {
  apiKey: string;
  model: string;
  schemaName: string;
  schema: Record<string, unknown>;
  signal?: AbortSignal;
  messages?: ChatCompletionMessageParam[];
  promptValue?: BasePromptValueInterface;
}
