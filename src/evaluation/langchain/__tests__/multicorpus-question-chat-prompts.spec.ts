import { describe, expect, it } from 'vitest';

import {
  MULTICORPUS_MULTI_CORPUS_CHAT_PROMPT,
  MULTICORPUS_MULTI_CORPUS_SYSTEM_PROMPT,
  MULTICORPUS_SINGLE_CORPUS_CHAT_PROMPT,
  MULTICORPUS_SINGLE_CORPUS_SYSTEM_PROMPT,
} from '../multicorpus-question-chat-prompts.js';

describe('MULTICORPUS_*_CHAT_PROMPT', () => {
  it('single-corpus: system + userContent match prior inline messages', async () => {
    const userContent = 'ARTICLES FOURNIS:\n[Article 1]\ncorpusId: code-penal';

    const promptValue = await MULTICORPUS_SINGLE_CORPUS_CHAT_PROMPT.invoke({
      userContent,
    });
    const messages = promptValue.toChatMessages();

    expect(messages).toHaveLength(2);
    expect(messages[0]?.content).toBe(MULTICORPUS_SINGLE_CORPUS_SYSTEM_PROMPT);
    expect(messages[1]?.content).toBe(userContent);
    expect(String(messages[1]?.content)).toContain('code-penal');
  });

  it('multi-corpus: system prompt is unchanged', async () => {
    const userContent = 'SCENARIOS:\n[Scenario 1]\n- corpusId: a';

    const promptValue = await MULTICORPUS_MULTI_CORPUS_CHAT_PROMPT.invoke({
      userContent,
    });
    const messages = promptValue.toChatMessages();

    expect(messages[0]?.content).toBe(MULTICORPUS_MULTI_CORPUS_SYSTEM_PROMPT);
    expect(messages[1]?.content).toBe(userContent);
  });
});
