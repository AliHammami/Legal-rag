import { describe, expect, it } from 'vitest';

import {
  buildE2EJudgeMessages,
  buildE2EJudgePromptInput,
} from '../../build-e2e-judge-messages.js';
import { E2E_JUDGE_CHAT_PROMPT } from '../e2e-judge-chat-prompt.js';

describe('E2E_JUDGE_CHAT_PROMPT', () => {
  it('produces the same messages as buildE2EJudgeMessages', async () => {
    const input = {
      questionId: 'q1',
      question: 'Question test',
      referenceAnswer: 'Référence',
      generatedAnswer: 'Réponse générée',
      context: 'Contexte RAG',
      expectedAbstention: false,
    };

    const expected = buildE2EJudgeMessages(input);
    const promptValue = await E2E_JUDGE_CHAT_PROMPT.invoke(
      buildE2EJudgePromptInput(input),
    );
    const messages = promptValue.toChatMessages();

    expect(messages).toHaveLength(2);
    expect(messages[0]?.content).toBe(expected[0]?.content);
    expect(messages[1]?.content).toBe(expected[1]?.content);
  });
});
