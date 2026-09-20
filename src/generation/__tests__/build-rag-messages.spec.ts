import { describe, expect, it } from 'vitest';
import { buildRagMessages, RAG_SYSTEM_PROMPT } from '../build-rag-messages.js';

describe('buildRagMessages', () => {
  it('separates system prompt, context, and question', () => {
    const messages = buildRagMessages(
      'Quelles sont les conditions de la légitime défense ?',
      '[Source 1 — Code pénal — Article 122-5 — chunk 0]\nTexte',
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

  it('describes a multicorpus legal assistant in the system prompt', () => {
    expect(RAG_SYSTEM_PROMPT).not.toContain(
      'assistant spécialisé dans le Code pénal',
    );
    expect(RAG_SYSTEM_PROMPT).toMatch(/assistant juridique/i);
    expect(RAG_SYSTEM_PROMPT).toMatch(/plusieurs codes/i);
  });

  it('includes citation and abstention instructions in the system prompt', () => {
    expect(RAG_SYSTEM_PROMPT).toContain('[Source N]');
    expect(RAG_SYSTEM_PROMPT).toMatch(/Article X du Code Y/i);
    expect(RAG_SYSTEM_PROMPT).toMatch(/contexte.*insuffisant|ne permettent pas de répondre/i);
    expect(RAG_SYSTEM_PROMPT).toMatch(/N'invente|n'invente/i);
    expect(RAG_SYSTEM_PROMPT).toMatch(/connaissances générales/i);
  });
});
