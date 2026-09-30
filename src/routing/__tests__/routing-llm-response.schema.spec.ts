import { describe, expect, it } from 'vitest';

import { RoutingLlmResponseSchema } from '../routing-llm-response.schema.js';

describe('RoutingLlmResponseSchema', () => {
  it('accepts a valid routing payload', () => {
    const parsed = RoutingLlmResponseSchema.safeParse({
      corpusIds: ['code-penal'],
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects non-array corpusIds', () => {
    const parsed = RoutingLlmResponseSchema.safeParse({
      corpusIds: 'code-penal',
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects unknown corpus ids at schema level', () => {
    const parsed = RoutingLlmResponseSchema.safeParse({
      corpusIds: ['unknown-corpus'],
    });
    expect(parsed.success).toBe(false);
  });
});
