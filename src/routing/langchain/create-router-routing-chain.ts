import type { Runnable } from '@langchain/core/runnables';

import type { RoutingLlmResponse } from '../routing-llm-response.schema.js';
import { ROUTER_CHAT_PROMPT } from './router-chat-prompt.js';

/** Prompt → modèle structured output (LCEL). Validation métier en aval. */
export function createRouterRoutingChain(
  structuredModel: Runnable<unknown, RoutingLlmResponse>,
) {
  return ROUTER_CHAT_PROMPT.pipe(structuredModel);
}
