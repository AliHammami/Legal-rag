import { AIMessage } from '@langchain/core/messages';
import { RunnableLambda } from '@langchain/core/runnables';
import { describe, expect, it, vi } from 'vitest';

import { createRagGenerationChain } from '../create-rag-generation-chain.js';

describe('createRagGenerationChain', () => {
  it('chain.invoke({ question, context }) returns trimmed answer text', async () => {
    const invoke = vi.fn().mockResolvedValue(new AIMessage('  R?ponse RAG.  '));
    const chain = createRagGenerationChain(
      RunnableLambda.from(invoke) as never,
    );

    const answer = await chain.invoke({
      question: 'Question ?',
      context: 'Contexte article',
    });

    expect(answer).toBe('R?ponse RAG.');
    expect(invoke).toHaveBeenCalledOnce();
  });

  it('rejects empty model content like the previous explicit flow', async () => {
    const invoke = vi.fn().mockResolvedValue(new AIMessage('   '));
    const chain = createRagGenerationChain(
      RunnableLambda.from(invoke) as never,
    );

    await expect(
      chain.invoke({ question: 'Q', context: 'C' }),
    ).rejects.toMatchObject({
      name: 'GenerationError',
      code: 'RESPONSE_EMPTY',
    });
  });
});
