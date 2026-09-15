import { describe, expect, it } from 'vitest';
import { buildRagMessages, RAG_SYSTEM_PROMPT } from '../build-rag-messages.js';

describe('buildRagMessages', () => {
  it('separates system prompt, context, and question', () => {
    const messages = buildRagMessages(
      'Quelles sont les conditions de la légitime défense ?',
      '[Source 1 — Article 122-5 — chunk 0]\nTexte',
    );

    expect(messages).toHaveLength(2);
    expect(messages[0]?.role).toBe('system');
    expect(messages[0]?.content).toBe(RAG_SYSTEM_PROMPT);
    expect(messages[1]?.role).toBe('user');
    expect(messages[1]?.content).toContain('CONTEXTE:');
    expect(messages[1]?.content).toContain('QUESTION:');
    expect(messages[1]?.content).toContain(
      'Quelles sont les conditions de la légitime défense ?',
    );
  });
});
