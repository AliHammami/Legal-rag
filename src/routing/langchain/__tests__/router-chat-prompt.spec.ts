import { describe, expect, it } from 'vitest';

import { CORPUS_ROUTING_DESCRIPTIONS } from '../../corpus-descriptions.js';
import { buildRouterMessages } from '../../router-prompt.js';
import {
  buildRouterPromptInput,
  ROUTER_CHAT_PROMPT,
} from '../router-chat-prompt.js';

describe('ROUTER_CHAT_PROMPT', () => {
  it('produces the same messages as buildRouterMessages', async () => {
    const question = 'Question p?nale ?';

    const expected = buildRouterMessages(question, CORPUS_ROUTING_DESCRIPTIONS);
    const promptValue = await ROUTER_CHAT_PROMPT.invoke(
      buildRouterPromptInput(question, CORPUS_ROUTING_DESCRIPTIONS),
    );
    const messages = promptValue.toChatMessages();

    expect(messages).toHaveLength(2);
    expect(messages[0]?.content).toBe(expected[0]?.content);
    expect(messages[1]?.content).toBe(expected[1]?.content);
    expect(String(messages[0]?.content)).toContain('code-penal');
    expect(messages[1]?.content).toBe(question);
  });
});
