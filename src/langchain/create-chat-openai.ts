import { ChatOpenAI } from '@langchain/openai';

export interface CreateChatOpenAIOptions {
  apiKey: string;
  model: string;
}

/** Instancie un ChatModel LangChain (une config par usage : routing, gen, judge, etc.). */
export function createChatOpenAI(options: CreateChatOpenAIOptions): ChatOpenAI {
  return new ChatOpenAI({
    apiKey: options.apiKey,
    model: options.model,
  });
}
