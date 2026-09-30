import { createChatOpenAI } from '../../langchain/create-chat-openai.js';

export interface CreateRagChatModelOptions {
  apiKey: string;
  model: string;
}

/** G?n?ration RAG : ChatOpenAI d?di? (mod?le RAG_GENERATION_MODEL). */
export function createRagChatModel(options: CreateRagChatModelOptions) {
  return createChatOpenAI(options);
}
