import { describe, expect, it } from 'vitest';

import { CORPUS_ROUTING_DESCRIPTIONS } from '../corpus-descriptions.js';
import {
  ROUTER_PROMPT_EXAMPLES,
  buildRouterMessages,
  buildRouterSystemPrompt,
} from '../router-prompt.js';
import { validateRoutingResult } from '../validate-routing-result.js';

describe('buildRouterSystemPrompt', () => {
  const prompt = buildRouterSystemPrompt(CORPUS_ROUTING_DESCRIPTIONS);

  it('states the coverage-oriented routing objective', () => {
    expect(prompt).toContain('TOUTES les dispositions juridiques');
    expect(prompt).toContain('Ne te limite PAS au corpus');
    expect(prompt).toMatch(/th.me principal/);
  });

  it('documents all six corpora with enriched descriptions', () => {
    for (const corpus of CORPUS_ROUTING_DESCRIPTIONS) {
      expect(prompt).toContain(corpus.id);
      expect(prompt).toContain(corpus.description);
    }
    expect(prompt).toContain('code-de-la-consommation');
    expect(prompt).toContain('code-monetaire-et-financier');
  });

  it('includes disambiguation guidance for confusable corpus pairs', () => {
    expect(prompt).toContain('Consommation vs mon');
    expect(prompt).toContain('Civil vs consommation');
    expect(prompt).toMatch(/P.nal vs civil/);
    expect(prompt).toContain('Travail vs civil');
  });

  it('includes representative few-shot routing examples', () => {
    expect(ROUTER_PROMPT_EXAMPLES.length).toBeGreaterThanOrEqual(8);
    for (const example of ROUTER_PROMPT_EXAMPLES) {
      expect(prompt).toContain(example.question);
      expect(prompt).toContain(JSON.stringify({ corpusIds: example.corpusIds }));
    }
  });
});

describe('ROUTER_PROMPT_EXAMPLES validation', () => {
  it('covers mono-corpus, multi-corpus, ambiguous and out-of-scope cases', () => {
    const labels = ROUTER_PROMPT_EXAMPLES.map((example) => example.label);
    expect(labels.some((label) => label.startsWith('mono-corpus'))).toBe(true);
    expect(labels.some((label) => label.startsWith('multi-corpus'))).toBe(true);
    expect(labels).toContain('ambigu');
    expect(labels).toContain('out-of-scope');
  });

  it('validates every example output against routing schema rules', () => {
    for (const example of ROUTER_PROMPT_EXAMPLES) {
      expect(validateRoutingResult({ corpusIds: [...example.corpusIds] })).toEqual({
        corpusIds: [...example.corpusIds],
      });
    }
  });

  it('includes multi-corpus examples for penal/civil and consommation/civil', () => {
    const penalCivil = ROUTER_PROMPT_EXAMPLES.find(
      (example) =>
        example.corpusIds.includes('code-penal') &&
        example.corpusIds.includes('code-civil') &&
        example.corpusIds.length === 2,
    );
    const consommationCivil = ROUTER_PROMPT_EXAMPLES.find(
      (example) =>
        example.corpusIds.includes('code-de-la-consommation') &&
        example.corpusIds.includes('code-civil') &&
        example.corpusIds.length === 2,
    );

    expect(penalCivil).toBeDefined();
    expect(consommationCivil).toBeDefined();
  });

  it('distinguishes consommation from monetaire et financier in mono-corpus examples', () => {
    const consommation = ROUTER_PROMPT_EXAMPLES.find(
      (example) =>
        example.corpusIds.length === 1 &&
        example.corpusIds[0] === 'code-de-la-consommation',
    );
    const monetaire = ROUTER_PROMPT_EXAMPLES.find(
      (example) =>
        example.corpusIds.length === 1 &&
        example.corpusIds[0] === 'code-monetaire-et-financier',
    );

    expect(consommation).toBeDefined();
    expect(monetaire).toBeDefined();
  });

  it('returns empty corpusIds for ambiguous and out-of-scope examples', () => {
    expect(
      ROUTER_PROMPT_EXAMPLES.find((example) => example.label === 'ambigu')?.corpusIds,
    ).toEqual([]);
    expect(
      ROUTER_PROMPT_EXAMPLES.find((example) => example.label === 'out-of-scope')
        ?.corpusIds,
    ).toEqual([]);
  });
});

describe('buildRouterMessages', () => {
  it('builds a system message and user question without extra turns', () => {
    const messages = buildRouterMessages('Question test', CORPUS_ROUTING_DESCRIPTIONS);

    expect(messages).toHaveLength(2);
    expect(messages[0]?.role).toBe('system');
    expect(messages[1]?.role).toBe('user');
    expect(messages[1]?.content).toBe('Question test');
    expect(messages[0]?.content).toContain('code-penal');
  });
});

describe('validateRoutingResult deduplication and unknown corpus', () => {
  it('deduplicates corpusIds', () => {
    expect(
      validateRoutingResult({
        corpusIds: ['code-civil', 'code-penal', 'code-civil'],
      }),
    ).toEqual({
      corpusIds: ['code-civil', 'code-penal'],
    });
  });

  it('rejects unknown corpus IDs', () => {
    expect(() =>
      validateRoutingResult({ corpusIds: ['code-route'] }),
    ).toThrow(/Unknown corpus/);
  });
});
