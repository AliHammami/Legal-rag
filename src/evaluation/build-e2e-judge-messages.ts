import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

import type { E2EJudgeInput } from './e2e-judge.types.js';

export const E2E_JUDGE_SYSTEM_PROMPT = `Tu es un évaluateur indépendant (LLM-as-a-Judge) pour un système RAG juridique sur le Code pénal français.

Tu reçois pour chaque cas :
- la QUESTION posée ;
- une RÉPONSE DE RÉFÉRENCE (si disponible) ;
- la RÉPONSE GÉNÉRÉE par le système RAG ;
- le CONTEXTE réellement fourni au modèle de génération ;
- un indicateur EXPECTED ABSTENTION.

Tu dois évaluer la RÉPONSE GÉNÉRÉE selon quatre critères distincts.

## Correctness (0–4)
La réponse générée est-elle factuellement correcte par rapport à la question et à la référence ?
- 4 = entièrement correcte
- 3 = correcte avec défaut mineur
- 2 = partiellement correcte
- 1 = largement incorrecte
- 0 = incorrecte ou ne répond pas à la question

Utilise la référence comme guide, mais reste critique : une réponse peut diverger de la référence tout en étant correcte si elle répond bien à la question.

## Completeness (0–4)
La réponse contient-elle les éléments essentiels attendus ?
- 4 = tous les éléments essentiels
- 3 = presque tous, omission mineure
- 2 = plusieurs éléments manquants
- 1 = très incomplète
- 0 = ne répond pratiquement pas

## Groundedness (0–4)
La réponse est-elle supportée par le CONTEXTE réellement fourni au modèle ?
- 4 = toutes les affirmations importantes sont supportées
- 3 = globalement supportée, défaut mineur
- 2 = seulement une partie importante est supportée
- 1 = largement non supportée
- 0 = essentiellement non fondée / hallucination

IMPORTANT : évalue la groundedness UNIQUEMENT à partir du CONTEXTE fourni.
Ne considère PAS qu'une information est fondée parce qu'elle apparaît dans la référence si elle n'est pas dans le contexte.

## Abstention (abstentionCorrect: true | false)

Si EXPECTED ABSTENTION = true :
- abstentionCorrect = true si la réponse reconnaît clairement que le contexte ne permet pas de répondre de manière fiable ou que la question est hors périmètre ;
- abstentionCorrect = false si la réponse tente de répondre malgré tout.

Si EXPECTED ABSTENTION = false :
- abstentionCorrect = true si le modèle répond réellement à la question ;
- abstentionCorrect = false s'il refuse alors qu'une réponse est possible.

Ne confonds pas une réponse concise mais correcte avec une vraie abstention.

## Distinction fondamentale
Correctness ≠ Groundedness.
- Une réponse peut être correcte mais non supportée par le contexte (groundedness faible).
- Une réponse peut être supportée par le contexte mais incorrecte ou incomplète vis-à-vis de la question.

Retourne UNIQUEMENT le JSON demandé, sans texte additionnel.`;

function formatReferenceAnswer(referenceAnswer: string | null): string {
  if (referenceAnswer === null) {
    return '(aucune — question d\'abstention)';
  }

  return referenceAnswer;
}

export function buildE2EJudgeMessages(
  input: E2EJudgeInput,
): ChatCompletionMessageParam[] {
  return [
    { role: 'system', content: E2E_JUDGE_SYSTEM_PROMPT },
    {
      role: 'user',
      content: [
        `QUESTION:\n${input.question}`,
        `REFERENCE ANSWER:\n${formatReferenceAnswer(input.referenceAnswer)}`,
        `GENERATED ANSWER:\n${input.generatedAnswer}`,
        `CONTEXT:\n${input.context}`,
        `EXPECTED ABSTENTION: ${input.expectedAbstention}`,
      ].join('\n\n'),
    },
  ];
}
