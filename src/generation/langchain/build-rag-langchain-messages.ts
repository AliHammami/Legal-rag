import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import type { BaseMessage } from '@langchain/core/messages';

import { buildRagMessages } from '../build-rag-messages.js';

/**
 * R?utilise les m?mes textes que buildRagMessages, au format attendu par invoke().
 */
export function buildRagLangChainMessages(
  question: string,
  context: string,
): BaseMessage[] {
  const openAiMessages = buildRagMessages(question, context);
  const system = openAiMessages[0];
  const user = openAiMessages[1];
  if (system?.role !== 'system' || user?.role !== 'user') {
    throw new Error('Unexpected RAG message shape');
  }
  const systemContent =
    typeof system.content === 'string'
      ? system.content
      : JSON.stringify(system.content);
  const userContent =
    typeof user.content === 'string'
      ? user.content
      : JSON.stringify(user.content);

  return [new SystemMessage(systemContent), new HumanMessage(userContent)];
}
