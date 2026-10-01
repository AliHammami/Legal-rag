import { RunnableLambda } from '@langchain/core/runnables';
import { describe, expect, it, vi } from 'vitest';

import { CORPUS_ROUTING_DESCRIPTIONS } from '../../corpus-descriptions.js';
import { createRouterRoutingChain } from '../create-router-routing-chain.js';
import { buildRouterPromptInput } from '../router-chat-prompt.js';

describe('createRouterRoutingChain', () => {
  it('chain.invoke returns structured routing payload from mocked model', async () => {
    const invoke = vi
      .fn()
      .mockResolvedValue({ corpusIds: ['code-penal'] });
    const chain = createRouterRoutingChain(RunnableLambda.from(invoke));

    const result = await chain.invoke(
      buildRouterPromptInput('Question test', CORPUS_ROUTING_DESCRIPTIONS),
    );

    expect(result).toEqual({ corpusIds: ['code-penal'] });
    expect(invoke).toHaveBeenCalledOnce();
  });
});
