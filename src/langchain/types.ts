export interface CreateEmbeddingsResult {
  index: number;
  embedding: number[];
}

export interface StructuredJsonChatInvokeOptions {
  apiKey: string;
  model: string;
  messages: import('openai/resources/chat/completions').ChatCompletionMessageParam[];
  schemaName: string;
  schema: Record<string, unknown>;
  signal?: AbortSignal;
}
