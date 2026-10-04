import { describe, expect, it } from 'vitest';

import {
  buildE2ESourceJudgeMessages,
  buildE2ESourceJudgePromptInput,
} from '../../build-e2e-source-judge-messages.js';
import { E2E_SOURCE_JUDGE_CHAT_PROMPT } from '../e2e-source-judge-chat-prompt.js';

describe('E2E_SOURCE_JUDGE_CHAT_PROMPT', () => {
  it('produces the same messages as buildE2ESourceJudgeMessages', async () => {
    const input = {
      questionId: 'q1',
      question: 'Question test',
      referenceAnswer: null,
      generatedAnswer: 'Réponse générée',
      expectedAbstention: true,
      sources: [
        {
          sourceId: 1,
          chunkId: '1#0',
          articleNumber: '1',
          content: 'Texte source',
        },
      ],
      judgeResult: null,
    };

    const expected = buildE2ESourceJudgeMessages(input);
    const promptValue = await E2E_SOURCE_JUDGE_CHAT_PROMPT.invoke(
      buildE2ESourceJudgePromptInput(input),
    );
    const messages = promptValue.toChatMessages();

    expect(messages).toHaveLength(2);
    expect(messages[0]?.content).toBe(expected[0]?.content);
    expect(messages[1]?.content).toBe(expected[1]?.content);
  });
});
