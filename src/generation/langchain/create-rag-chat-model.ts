import { createChatOpenAI } from '../../langchain/create-chat-openai.js';

export interface CreateRagChatModelOptions {
  apiKey: string;
  model: string;
}

/** Génération RAG : ChatOpenAI dédié (modèle RAG_GENERATION_MODEL). */
export function createRagChatModel(options: CreateRagChatModelOptions) {
  return createChatOpenAI(options);
}
