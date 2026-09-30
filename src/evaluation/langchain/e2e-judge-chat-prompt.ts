import { ChatPromptTemplate } from '@langchain/core/prompts';

import {
  E2E_JUDGE_SYSTEM_PROMPT,
  E2E_JUDGE_USER_MESSAGE_TEMPLATE,
} from '../build-e2e-judge-messages.js';

export const E2E_JUDGE_CHAT_PROMPT = ChatPromptTemplate.fromMessages([
  ['system', E2E_JUDGE_SYSTEM_PROMPT],
  ['human', E2E_JUDGE_USER_MESSAGE_TEMPLATE],
]);
