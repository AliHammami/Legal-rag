import { ChatPromptTemplate } from '@langchain/core/prompts';

import {
  RAG_SYSTEM_PROMPT,
  RAG_USER_MESSAGE_TEMPLATE,
} from '../build-rag-messages.js';

/** Variables runtime : `question`, `context`. */
export const RAG_GENERATION_CHAT_PROMPT = ChatPromptTemplate.fromMessages([
  ['system', RAG_SYSTEM_PROMPT],
  ['human', RAG_USER_MESSAGE_TEMPLATE],
]);

export type RagGenerationPromptInput = {
  question: string;
  context: string;
};
