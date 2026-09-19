import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

import type { CorpusRoutingDescription } from './types.js';

function formatCorpusList(corpora: readonly CorpusRoutingDescription[]): string {
  return corpora
    .map((corpus) => `- ${corpus.id} (${corpus.codeName}) : ${corpus.description}`)
    .join('\n');
}

/** Illustrative routing decisions embedded in the system prompt (not live few-shot turns). */
export const ROUTER_PROMPT_EXAMPLES = [
  {
    label: 'mono-corpus pénal',
    question:
      'Quelles sont les conditions de la légitime défense en cas de agression nocturne ?',
    corpusIds: ['code-penal'],
  },
  {
    label: 'mono-corpus travail',
    question:
      'Un employeur peut-il licencier un salarié pour faute grave sans procédure préalable ?',
    corpusIds: ['code-du-travail'],
  },
  {
    label: 'mono-corpus consommation',
    question:
      'Quel délai de rétractation s\'applique à un crédit à la consommation souscrit à domicile ?',
    corpusIds: ['code-de-la-consommation'],
  },
  {
    label: 'mono-corpus monétaire et financier',
    question:
      'Quelles obligations de vigilance incombent à une banque en matière de lutte contre le blanchiment ?',
    corpusIds: ['code-monetaire-et-financier'],
  },
  {
    label: 'multi-corpus consommation + civil',
    question:
      'Quelles sont les obligations d\'un professionnel envers un consommateur lorsqu\'un produit vendu est défectueux et quelles actions civiles peut exercer l\'acheteur ?',
    corpusIds: ['code-de-la-consommation', 'code-civil'],
  },
  {
    label: 'multi-corpus pénal + civil',
    question:
      'Quelles sont les conséquences pénales et les dommages-intérêts civils en cas de violences volontaires ayant causé une incapacité ?',
    corpusIds: ['code-penal', 'code-civil'],
  },
  {
    label: 'multi-corpus commerce + monétaire et financier',
    question:
      'Quelles règles encadrent l\'émission d\'obligations par une société commerciale sur un marché financier réglementé ?',
    corpusIds: ['code-du-commerce', 'code-monetaire-et-financier'],
  },
  {
    label: 'multi-corpus travail + civil',
    question:
      'Un salarié peut-il invoquer à la fois des règles de droit du travail et des règles de responsabilité civile contractuelle contre son employeur ?',
    corpusIds: ['code-du-travail', 'code-civil'],
  },
  {
    label: 'ambigu',
    question: 'Quelle est la loi en France ?',
    corpusIds: [] as string[],
  },
  {
    label: 'out-of-scope',
    question:
      'Quelle peine encourt-on pour un excès de vitesse sur autoroute au code de la route ?',
    corpusIds: [] as string[],
  },
] as const;

function formatPromptExamples(): string {
  return ROUTER_PROMPT_EXAMPLES.map(
    (example) =>
      `Question : ${example.question}\nRéponse attendue : ${JSON.stringify({ corpusIds: example.corpusIds })}`,
  ).join('\n\n');
}

export function buildRouterSystemPrompt(
  corpora: readonly CorpusRoutingDescription[],
): string {
  return `Tu es un routeur juridique pour un système RAG multi-corpus.

Ta mission : répondre à la question suivante (et non à une autre) :
« Dans quels corpus dois-je chercher pour avoir une chance raisonnable de retrouver TOUTES les dispositions juridiques nécessaires à une réponse complète ? »

Ne te limite PAS au corpus qui semble être le thème principal ou le plus évident. Si plusieurs branches du droit apportent chacune des règles nécessaires, tu dois toutes les inclure.

Corpus disponibles (utilise uniquement ces IDs exacts dans corpusIds) :
${formatCorpusList(corpora)}

## Règles de décision

1. **Mono-corpus** : si une réponse complète peut raisonnablement être fondée sur un seul corpus, retourne uniquement ce corpus. N'ajoute pas d'autres corpus « par prudence » ou parce qu'ils contiennent des notions générales.

2. **Multi-corpus** : si la question exige des règles issues de plusieurs branches distinctes, retourne TOUS les corpus pertinents. Ne retiens pas seulement le corpus dominant : un corpus secondaire peut contenir une disposition indispensable (responsabilité civile, garanties, procédure, etc.).

3. **Mention ≠ nécessité** : le simple fait qu'une question mentionne un consommateur, une entreprise, un salarié ou un contrat ne suffit pas à sélectionner plusieurs corpus. Il faut identifier si plusieurs corpus contiennent réellement des règles nécessaires.

4. **Couverture multi-dimensionnelle** : lorsqu'une question présente clairement plusieurs dimensions juridiques distinctes (ex. sanctions pénales + réparation civile ; protection du consommateur + droit commun des obligations), favorise l'inclusion de tous les corpus justifiés plutôt que le corpus le plus visible.

5. **Ambigu** : si la question est trop vague ou ne permet pas d'identifier de manière fiable un corpus pertinent, retourne {"corpusIds": []}.

6. **Hors périmètre** : si la question ne relève d'aucun des six corpus (autre matière, autre code non disponible), retourne {"corpusIds": []}.

7. **Sujet vs source juridique** : ne choisis pas un corpus uniquement sur un mot-clé isolé. Interprète le contexte juridique complet de la question.

8. **Pas d'invention** : chaque corpus retourné doit être justifiable par le contenu de la question. Ne retourne pas tous les corpus « par sécurité ».

9. **Ordre** : l'ordre des corpusIds n'a pas d'importance.

10. **Principe central** : maximise la probabilité que les documents nécessaires à une réponse complète soient dans les corpus sélectionnés — pas la probabilité que le premier corpus soit le « bon thème ».

## Paires fréquemment confondues

- **Consommation vs monétaire et financier** :
  - crédit à la consommation, vente au consommateur, garanties légales, clauses abusives → code-de-la-consommation ;
  - activité bancaire, établissement de crédit, marchés/instruments financiers, blanchiment → code-monetaire-et-financier ;
  - si les deux dimensions sont requises pour répondre, retourne les deux.

- **Civil vs consommation** :
  - droit commun des obligations, responsabilité civile générale, dommages-intérêts → code-civil ;
  - régime spécifique professionnel/consommateur, garanties de conformité, crédit à la consommation → code-de-la-consommation ;
  - une question sur la responsabilité d'un professionnel envers un consommateur peut nécessiter les deux.

- **Pénal vs civil** :
  - infraction, peine, éléments constitutifs, circonstances → code-penal ;
  - réparation du prejudice, dommages-intérêts, responsabilité civile → code-civil ;
  - une question mêlant qualification pénale et conséquences civiles nécessite les deux.

- **Travail vs civil** :
  - relation employeur/salarié, licenciement, rémunération, durée du travail → code-du-travail ;
  - contrat civil général hors relation de travail, responsabilité civile générale → code-civil ;
  - si la question exige explicitement des règles des deux branches, retourne les deux.

- **Commerce vs monétaire et financier** :
  - actes de commerce, sociétés commerciales, fonds de commerce → code-du-commerce ;
  - opérations bancaires/financières réglementées, marchés financiers → code-monetaire-et-financier.

## Exemples de routage (format de sortie strict)

${formatPromptExamples()}

## Format de sortie

Réponds uniquement avec un objet JSON strict :
{"corpusIds": ["..."]}

- corpusIds : tableau d'IDs de corpus pertinents, ou [] si ambigu ou hors périmètre.
- N'invente aucun corpusId.
- Pas de champ supplémentaire.`;
}

export function buildRouterMessages(
  question: string,
  corpora: readonly CorpusRoutingDescription[],
): ChatCompletionMessageParam[] {
  return [
    {
      role: 'system',
      content: buildRouterSystemPrompt(corpora),
    },
    {
      role: 'user',
      content: question,
    },
  ];
}
