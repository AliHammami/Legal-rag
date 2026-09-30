import { describe, expect, it } from 'vitest';

import {
  buildRagMessages,
  formatRagUserMessageContent,
  RAG_SYSTEM_PROMPT,
} from '../../build-rag-messages.js';
import { RAG_GENERATION_CHAT_PROMPT } from '../rag-generation-chat-prompt.js';

describe('RAG_GENERATION_CHAT_PROMPT', () => {
  it('produces the same messages as buildRagMessages', async () => {
    const question = 'Quelle est la peine ?';
    const context = 'Article 222-1 ...';

    const expected = buildRagMessages(question, context);
    const promptValue = await RAG_GENERATION_CHAT_PROMPT.invoke({
      question,
      context,
    });
    const messages = promptValue.toChatMessages();

    expect(messages).toHaveLength(2);
    expect(messages[0]?.content).toBe(expected[0]?.content);
    expect(messages[0]?.content).toBe(RAG_SYSTEM_PROMPT);
    expect(messages[1]?.content).toBe(expected[1]?.content);
    expect(messages[1]?.content).toBe(
      formatRagUserMessageContent(question, context),
    );
    expect(String(messages[1]?.content)).toContain('CONTEXTE:');
    expect(String(messages[1]?.content)).toContain('QUESTION:');
    expect(String(messages[1]?.content)).toContain(question);
    expect(String(messages[1]?.content)).toContain(context);
  });
});
