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

  it('states the dimension-oriented routing objective', () => {
    expect(prompt).toContain('réponse juridiquement complète');
    expect(prompt).toContain('dimensions juridiques réellement nécessaires');
    expect(prompt).not.toContain('chance raisonnable');
  });

  it('documents all six corpora with enriched descriptions', () => {
    for (const corpus of CORPUS_ROUTING_DESCRIPTIONS) {
      expect(prompt).toContain(corpus.id);
      expect(prompt).toContain(corpus.description);
    }
    expect(prompt).toContain('code-de-la-consommation');
    expect(prompt).toContain('code-monetaire-et-financier');
  });

  it('includes multi-corpus branch analysis rule', () => {
    expect(prompt).toContain('PRIORITÉ ÉLEVÉE');
    expect(prompt).toContain('analyse chaque branche séparément');
    expect(prompt).toMatch(/analyser s[ée]par[ée]ment les branches/);
  });

  it('includes anti-keyword anchoring guardrails', () => {
    expect(prompt).toContain('IPC');
    expect(prompt).toContain('indice national des prix à la consommation');
    expect(prompt).toContain('Sanctions ≠ automatiquement pénal');
    expect(prompt).toContain('Nullité ≠ automatiquement civil');
    expect(prompt).toContain('notaire');
    expect(prompt).toContain('protêt');
  });

  it('includes V3.1 surgical rules for sanctions and specialized domains', () => {
    expect(prompt).toContain('Sanction civile');
    expect(prompt).toContain('Sanctions d\'un délit');
    expect(prompt).toContain('Fausses informations commerciales');
    expect(prompt).toContain('État civil et sanctions associées');
    expect(prompt).toContain('Anti-abstention prématurée');
    expect(prompt).toContain('domaine juridique identifiable');
  });

  it('includes V3.1 final-pass rules for Code pénal, CPP, prix and SICAV', () => {
    expect(prompt).toContain('Référence explicite au Code pénal');
    expect(prompt).toContain('signal fort');
    expect(prompt).toContain('code de procédure pénale (CPP)');
    expect(prompt).toContain('Manipulation artificielle / frauduleuse des prix');
    expect(prompt).toContain('Prix élevé');
    expect(prompt).toContain('ajournement du prononcé de la peine');
    expect(prompt).toContain('SICAV + ajournement du prononcé de la peine');
    expect(prompt).toMatch(/article 123.*(insuffisant|ambigu)/s);
  });

  it('includes V3.1 surgical abstention and structured reference rules', () => {
    expect(prompt).toContain('Ordre de priorité : abstention vs anti-abstention');
    expect(prompt).toContain('Références juridiques structurées (L., D., R.)');
    expect(prompt).toContain('Structure + contexte');
    expect(prompt).toContain('L6234-1');
    expect(prompt).toContain('L7234-1');
    expect(prompt).toContain('Agence nationale des services à la personne');
    expect(prompt).toMatch(/L7xxx ou L72xx.*absence.*contexte cohérent/s);
    expect(prompt).toContain('712-1');
    expect(prompt).toContain('publicité des prix');
    expect(prompt).toContain('force majeure');
    expect(prompt).toContain('copropriété');
    expect(prompt).toContain("s'applique après ambigu/OOS");
  });

  it('includes internal reasoning sequence without changing output schema', () => {
    expect(prompt).toContain('Séquence de raisonnement');
    expect(prompt).toContain('ne pas exposer dans la sortie');
    expect(prompt).toContain('Pas de champ supplémentaire');
  });

  it('includes gold-independent reasoning rule', () => {
    expect(prompt).toContain('Raisonnement indépendant du gold');
    expect(prompt).toContain("Ne tente pas de deviner quel article");
  });

  it('includes disambiguation guidance for confusable corpus pairs', () => {
    expect(prompt).toContain('Consommation vs mon');
    expect(prompt).toContain('Civil vs consommation');
    expect(prompt).toMatch(/P.nal vs civil/);
    expect(prompt).toContain('Travail vs civil');
    expect(prompt).toContain('Pénal vs travail');
    expect(prompt).toContain('Civil vs commerce');
  });

  it('includes representative few-shot routing examples', () => {
    expect(ROUTER_PROMPT_EXAMPLES.length).toBeGreaterThanOrEqual(14);
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

  it('includes V3 diagnostic-targeted few-shot examples', () => {
    const labels = ROUTER_PROMPT_EXAMPLES.map((example) => example.label);
    expect(labels).toContain('multi-dimension consommation + pénal (branches explicites)');
    expect(labels).toContain('IPC sans code consommation (travail + monétaire)');
    expect(labels).toContain('sanction disciplinaire travail (sans pénal)');
    expect(labels).toContain('nullité commerciale (sans civil)');
    expect(labels).toContain('frontière monétaire notaire/protêt (sans commerce)');
    expect(labels).toContain(
      'dimension transversale insuffisamment identifiable (mono-corpus)',
    );
  });

  it('includes V3.1 targeted few-shot examples', () => {
    const labels = ROUTER_PROMPT_EXAMPLES.map((example) => example.label);
    expect(labels).toContain('sanction civile (sans pénal ni consommation)');
    expect(labels).toContain('sanctions délit consommation (corpus source)');
    expect(labels).toContain('nationalité civil + fausses infos commerciales commerce');
    expect(labels).toContain('signes qualité produits consommation (sans mot consommateur)');
    expect(labels).toContain('chèque peines monétaire + pénal');
  });

  it('includes V3.1 final-pass few-shot examples', () => {
    const labels = ROUTER_PROMPT_EXAMPLES.map((example) => example.label);
    expect(labels).toContain('article Code pénal explicite (sans abstention)');
    expect(labels).toContain('manipulation artificielle des prix (pénal, pas commerce)');
    expect(labels).toContain('prix ordinaire commerce (sans pénal)');
    expect(labels).toContain('garde à vue procédure pénale (OOS, pas code pénal)');
    expect(labels).toContain('SICAV + ajournement peine (sans civil)');
  });

  it('includes V3.1 surgical few-shot examples for regressions and targets', () => {
    const labels = ROUTER_PROMPT_EXAMPLES.map((example) => example.label);
    expect(labels).toContain('CPP explicite (OOS, pas code pénal)');
    expect(labels).toContain('article L6234-1 travail (référence structurée, sans abstention)');
    expect(labels).toContain('ANSP recrutement (contexte institutionnel → travail, sans citation L.)');
    expect(labels).toContain('L7234-1 + contexte recrutement ANSP (structure + thème)');
    expect(labels).toContain('L7234-1 seul sans contexte matière (abstention)');
    expect(labels).toContain('article 712-1 diffusion décisions judiciaires (pénal, pas CPP)');
    expect(labels).toContain('force majeure transversale (ambigu, abstention)');
    expect(labels).toContain('faillite générale (ambigu, abstention)');
    expect(labels).toContain('copropriété OOS identifiable (abstention, pas civil)');
    expect(labels).toContain('publicité des prix sans ancrage (ambigu, abstention)');
  });

  it('IPC example excludes code-de-la-consommation', () => {
    const ipcExample = ROUTER_PROMPT_EXAMPLES.find((example) =>
      example.label.startsWith('IPC sans code consommation'),
    );
    expect(ipcExample?.corpusIds).not.toContain('code-de-la-consommation');
    expect(ipcExample?.corpusIds).toEqual(['code-du-commerce', 'code-du-travail']);
  });

  it('sanction disciplinaire example excludes code-penal', () => {
    const sanctionExample = ROUTER_PROMPT_EXAMPLES.find((example) =>
      example.label.startsWith('sanction disciplinaire travail'),
    );
    expect(sanctionExample?.corpusIds).not.toContain('code-penal');
    expect(sanctionExample?.corpusIds).toEqual([
      'code-du-travail',
      'code-monetaire-et-financier',
    ]);
  });

  it('nullité commerciale example excludes code-civil', () => {
    const nulliteExample = ROUTER_PROMPT_EXAMPLES.find((example) =>
      example.label.startsWith('nullité commerciale'),
    );
    expect(nulliteExample?.corpusIds).not.toContain('code-civil');
    expect(nulliteExample?.corpusIds).toEqual(['code-du-commerce', 'code-penal']);
  });

  it('notaire/protêt example excludes code-du-commerce and code-penal', () => {
    const notaireExample = ROUTER_PROMPT_EXAMPLES.find((example) =>
      example.label.startsWith('frontière monétaire notaire/protêt'),
    );
    expect(notaireExample?.corpusIds).not.toContain('code-du-commerce');
    expect(notaireExample?.corpusIds).not.toContain('code-penal');
    expect(notaireExample?.corpusIds).toEqual([
      'code-civil',
      'code-monetaire-et-financier',
    ]);
  });

  it('sanction civile example excludes code-penal and consommation', () => {
    const example = ROUTER_PROMPT_EXAMPLES.find((e) =>
      e.label.startsWith('sanction civile'),
    );
    expect(example?.corpusIds).toEqual(['code-civil']);
  });

  it('sanctions délit consommation example excludes code-penal', () => {
    const example = ROUTER_PROMPT_EXAMPLES.find((e) =>
      e.label.startsWith('sanctions délit consommation'),
    );
    expect(example?.corpusIds).toEqual(['code-de-la-consommation']);
    expect(example?.corpusIds).not.toContain('code-penal');
  });

  it('nationalité example uses civil and commerce without penal', () => {
    const example = ROUTER_PROMPT_EXAMPLES.find((e) =>
      e.label.startsWith('nationalité civil'),
    );
    expect(example?.corpusIds).toEqual(['code-civil', 'code-du-commerce']);
    expect(example?.corpusIds).not.toContain('code-penal');
  });

  it('chèque peines example includes monetaire and penal', () => {
    const example = ROUTER_PROMPT_EXAMPLES.find((e) =>
      e.label.startsWith('chèque peines'),
    );
    expect(example?.corpusIds).toEqual([
      'code-monetaire-et-financier',
      'code-penal',
    ]);
  });

  it('article Code pénal explicite example routes to penal only', () => {
    const example = ROUTER_PROMPT_EXAMPLES.find((e) =>
      e.label.startsWith('article Code pénal explicite'),
    );
    expect(example?.corpusIds).toEqual(['code-penal']);
  });

  it('manipulation artificielle des prix example routes to penal not commerce', () => {
    const example = ROUTER_PROMPT_EXAMPLES.find((e) =>
      e.label.startsWith('manipulation artificielle des prix'),
    );
    expect(example?.corpusIds).toEqual(['code-penal']);
    expect(example?.corpusIds).not.toContain('code-du-commerce');
  });

  it('prix ordinaire commerce example excludes penal', () => {
    const example = ROUTER_PROMPT_EXAMPLES.find((e) =>
      e.label.startsWith('prix ordinaire commerce'),
    );
    expect(example?.corpusIds).toEqual(['code-du-commerce']);
    expect(example?.corpusIds).not.toContain('code-penal');
  });

  it('garde à vue procédure pénale example abstains (OOS, not penal)', () => {
    const example = ROUTER_PROMPT_EXAMPLES.find((e) =>
      e.label.startsWith('garde à vue procédure pénale'),
    );
    expect(example?.corpusIds).toEqual([]);
    expect(example?.corpusIds).not.toContain('code-penal');
  });

  it('SICAV ajournement example excludes civil', () => {
    const example = ROUTER_PROMPT_EXAMPLES.find((e) =>
      e.label.startsWith('SICAV + ajournement peine'),
    );
    expect(example?.corpusIds).toEqual([
      'code-monetaire-et-financier',
      'code-penal',
    ]);
    expect(example?.corpusIds).not.toContain('code-civil');
  });

  it('L6234-1 example routes to travail without abstention', () => {
    const example = ROUTER_PROMPT_EXAMPLES.find((e) =>
      e.label.startsWith('article L6234-1 travail'),
    );
    expect(example?.corpusIds).toEqual(['code-du-travail']);
    expect(example?.question).toContain('L6234-1');
  });

  it('ANSP recrutement example routes to travail via institutional context', () => {
    const example = ROUTER_PROMPT_EXAMPLES.find((e) =>
      e.label.startsWith('ANSP recrutement'),
    );
    expect(example?.corpusIds).toEqual(['code-du-travail']);
    expect(example?.question).toMatch(/Agence nationale des services à la personne/);
    expect(example?.question).toMatch(/recrutement/);
    expect(example?.question).not.toContain('L7234-1');
  });

  it('L7234-1 with ANSP recrutement context routes to travail', () => {
    const example = ROUTER_PROMPT_EXAMPLES.find((e) =>
      e.label.startsWith('L7234-1 + contexte recrutement ANSP'),
    );
    expect(example?.corpusIds).toEqual(['code-du-travail']);
    expect(example?.question).toContain('L7234-1');
    expect(example?.question).toMatch(/Agence nationale des services à la personne/);
  });

  it('L7234-1 alone without thematic context abstains (no automatic travail)', () => {
    const example = ROUTER_PROMPT_EXAMPLES.find((e) =>
      e.label.startsWith('L7234-1 seul sans contexte matière'),
    );
    expect(example?.corpusIds).toEqual([]);
    expect(example?.corpusIds).not.toContain('code-du-travail');
    expect(example?.question).toBe("Que prévoit l'article L7234-1 ?");
  });

  it('712-1 judicial diffusion example routes to penal not CPP', () => {
    const example = ROUTER_PROMPT_EXAMPLES.find((e) =>
      e.label.startsWith('article 712-1 diffusion'),
    );
    expect(example?.corpusIds).toEqual(['code-penal']);
    expect(example?.corpusIds).not.toContain('code-civil');
    expect(example?.question).toContain('712-1');
  });

  it('CPP explicite example abstains without penal', () => {
    const example = ROUTER_PROMPT_EXAMPLES.find((e) =>
      e.label.startsWith('CPP explicite'),
    );
    expect(example?.corpusIds).toEqual([]);
    expect(example?.corpusIds).not.toContain('code-penal');
    expect(example?.question).toMatch(/CPP/i);
  });

  it('force majeure example abstains (transversal ambiguous)', () => {
    const example = ROUTER_PROMPT_EXAMPLES.find((e) =>
      e.label.startsWith('force majeure transversale'),
    );
    expect(example?.corpusIds).toEqual([]);
    expect(example?.corpusIds).not.toContain('code-civil');
  });

  it('faillite example abstains (general ambiguous)', () => {
    const example = ROUTER_PROMPT_EXAMPLES.find((e) =>
      e.label.startsWith('faillite générale'),
    );
    expect(example?.corpusIds).toEqual([]);
    expect(example?.corpusIds).not.toContain('code-du-commerce');
  });

  it('copropriété example abstains without civil (OOS identifiable)', () => {
    const example = ROUTER_PROMPT_EXAMPLES.find((e) =>
      e.label.startsWith('copropriété OOS'),
    );
    expect(example?.corpusIds).toEqual([]);
    expect(example?.corpusIds).not.toContain('code-civil');
  });

  it('publicité des prix example abstains without commerce or consommation', () => {
    const example = ROUTER_PROMPT_EXAMPLES.find((e) =>
      e.label.startsWith('publicité des prix sans ancrage'),
    );
    expect(example?.corpusIds).toEqual([]);
    expect(example?.corpusIds).not.toContain('code-du-commerce');
    expect(example?.corpusIds).not.toContain('code-de-la-consommation');
  });

  it('manipulation artificielle and publicité des prix examples are distinct', () => {
    const manipulation = ROUTER_PROMPT_EXAMPLES.find((e) =>
      e.label.startsWith('manipulation artificielle des prix'),
    );
    const publicite = ROUTER_PROMPT_EXAMPLES.find((e) =>
      e.label.startsWith('publicité des prix sans ancrage'),
    );
    expect(manipulation?.corpusIds).toEqual(['code-penal']);
    expect(publicite?.corpusIds).toEqual([]);
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

describe('CORPUS_ROUTING_DESCRIPTIONS', () => {
  it('clarifies corpus boundaries relevant to V3 anti-keyword rules', () => {
    const penal = CORPUS_ROUTING_DESCRIPTIONS.find((c) => c.id === 'code-penal');
    const civil = CORPUS_ROUTING_DESCRIPTIONS.find((c) => c.id === 'code-civil');
    const travail = CORPUS_ROUTING_DESCRIPTIONS.find((c) => c.id === 'code-du-travail');
    const commerce = CORPUS_ROUTING_DESCRIPTIONS.find((c) => c.id === 'code-du-commerce');
    const monetaire = CORPUS_ROUTING_DESCRIPTIONS.find(
      (c) => c.id === 'code-monetaire-et-financier',
    );
    const consommation = CORPUS_ROUTING_DESCRIPTIONS.find(
      (c) => c.id === 'code-de-la-consommation',
    );

    expect(penal?.description).toMatch(/disciplinaires/);
    expect(penal?.description).toMatch(/procédure pénale \(CPP\)/);
    expect(penal?.description).toMatch(/manipulation artificielle/);
    expect(travail?.description).toMatch(/disciplinaires/);
    expect(commerce?.description).toMatch(/chèques|protêts/);
    expect(commerce?.description).toMatch(/politique tarifaire/);
    expect(commerce?.description).toMatch(/manipulation artificielle/);
    expect(monetaire?.description).toMatch(/chèques|protêts/);
    expect(consommation?.description).toMatch(/IPC|indice des prix/);
    expect(consommation?.description).toMatch(/signes officiels|qualité|origine/);
    expect(civil?.description).toMatch(/sanctions civiles|état civil/);
    expect(commerce?.description).toMatch(/fausses informations commerciales/);
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
