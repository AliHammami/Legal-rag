import type { Runnable } from '@langchain/core/runnables';

import type { RoutingLlmResponse } from '../routing-llm-response.schema.js';
import { ROUTER_CHAT_PROMPT } from './router-chat-prompt.js';

/** Prompt ? mod?le structured output (LCEL). Validation m?tier en aval. */
export function createRouterRoutingChain(
  structuredModel: Runnable<unknown, RoutingLlmResponse>,
) {
  return ROUTER_CHAT_PROMPT.pipe(structuredModel);
}
