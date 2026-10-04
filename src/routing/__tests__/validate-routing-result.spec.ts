import { describe, expect, it } from 'vitest';

import { RoutingError } from '../routing.error.js';
import { validateRoutingResult } from '../validate-routing-result.js';

describe('validateRoutingResult', () => {
  it('accepts a single known corpus', () => {
    expect(validateRoutingResult({ corpusIds: ['code-penal'] })).toEqual({
      corpusIds: ['code-penal'],
    });
  });

  it('accepts multiple known corpora without duplicates', () => {
    expect(
      validateRoutingResult({
        corpusIds: ['code-civil', 'code-du-travail', 'code-civil'],
      }),
    ).toEqual({
      corpusIds: ['code-civil', 'code-du-travail'],
    });
  });

  it('accepts an empty corpusIds array for ambiguous routing', () => {
    expect(validateRoutingResult({ corpusIds: [] })).toEqual({
      corpusIds: [],
    });
  });

  it('accepts an optional reason', () => {
    expect(
      validateRoutingResult({
        corpusIds: ['code-penal'],
        reason: 'Question clairement pénale.',
      }),
    ).toEqual({
      corpusIds: ['code-penal'],
      reason: 'Question clairement pénale.',
    });
  });

  it('rejects unknown corpus IDs', () => {
    expect(() =>
      validateRoutingResult({ corpusIds: ['unknown-corpus'] }),
    ).toThrow(RoutingError);
    expect(() =>
      validateRoutingResult({ corpusIds: ['unknown-corpus'] }),
    ).toThrow(/Unknown corpus/);
  });

  it('rejects malformed JSON shapes', () => {
    expect(() => validateRoutingResult(null)).toThrow(RoutingError);
    expect(() => validateRoutingResult({ corpusIds: 'code-penal' })).toThrow(
      RoutingError,
    );
    expect(() => validateRoutingResult({ corpusIds: [''] })).toThrow(
      RoutingError,
    );
    expect(() => validateRoutingResult({})).toThrow(RoutingError);
  });

  it('rejects unexpected fields', () => {
    expect(() =>
      validateRoutingResult({
        corpusIds: ['code-penal'],
        confidence: 0.9,
      }),
    ).toThrow(/Unexpected field/);
  });
});
