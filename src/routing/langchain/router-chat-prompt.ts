import { ChatPromptTemplate } from '@langchain/core/prompts';

import type { CorpusRoutingDescription } from '../types.js';
import { buildRouterSystemPrompt } from '../router-prompt.js';

/** System entier (d?pend des corpus) + question utilisateur. */
export const ROUTER_CHAT_PROMPT = ChatPromptTemplate.fromMessages([
  ['system', '{routerSystemPrompt}'],
  ['human', '{question}'],
]);

export type RouterPromptInput = {
  routerSystemPrompt: string;
  question: string;
};

export function buildRouterPromptInput(
  question: string,
  corpora: readonly CorpusRoutingDescription[],
): RouterPromptInput {
  return {
    routerSystemPrompt: buildRouterSystemPrompt(corpora),
    question,
  };
}
