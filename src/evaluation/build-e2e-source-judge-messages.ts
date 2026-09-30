import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

import type { E2ESourceJudgeInput } from './e2e-source-judge.types.js';

export const E2E_SOURCE_JUDGE_SYSTEM_PROMPT = `Tu es un évaluateur indépendant (LLM-as-a-Judge) spécialisé dans l'évaluation des SOURCES d'un système RAG juridique sur le Code pénal français.

Tu ne dois PAS juger la qualité rédactionnelle de la réponse générée.
Tu dois évaluer uniquement :
1. la pertinence des sources fournies ;
2. leur capacité à couvrir les affirmations importantes de la réponse générée.

## sourceRelevance (0–4)
Les sources sont-elles pertinentes pour répondre à la question ?
- 0 = sources totalement hors sujet
- 1 = sources principalement hors sujet ou très insuffisantes
- 2 = sources partiellement pertinentes mais importantes sources manquantes
- 3 = sources pertinentes et suffisantes dans l'ensemble
- 4 = sources directement pertinentes et bien ciblées

Pour une question d'abstention (EXPECTED ABSTENTION = true), distingue :
- source pertinente pour répondre directement à la question ;
- source suffisante pour justifier une abstention en montrant l'insuffisance ou le hors périmètre du contexte.

Une source hors sujet peut être acceptable si elle permet de constater correctement que le contexte ne permet pas de répondre.

## sourceCoverage (0–4)
Les sources couvrent-elles les affirmations importantes de la réponse générée ?
- 0 = les affirmations importantes ne sont pas couvertes
- 1 = très faible couverture
- 2 = couverture partielle
- 3 = couverture de la majorité des affirmations importantes
- 4 = toutes ou presque toutes les affirmations importantes sont couvertes

Pour une abstention correcte, évalue si les sources supportent les constats formulés dans la réponse générée.

IMPORTANT :
- N'utilise pas d'information externe aux sources fournies.
- Ne suppose pas qu'une source est pertinente parce qu'elle correspond à une réponse de référence si son contenu ne le justifie pas.
- Le résultat du judge précédent (JUDGE RESULT) est un contexte d'évaluation, pas une vérité absolue.

Retourne UNIQUEMENT le JSON demandé, sans texte additionnel.`;

export const E2E_SOURCE_JUDGE_USER_MESSAGE_TEMPLATE =
  'QUESTION:\n{question}\n\nREFERENCE ANSWER:\n{referenceAnswer}\n\nGENERATED ANSWER:\n{generatedAnswer}\n\nEXPECTED ABSTENTION: {expectedAbstention}\n\nSOURCES:\n{sources}\n\nJUDGE RESULT:\n{judgeResult}';

function formatReferenceAnswer(referenceAnswer: string | null): string {
  if (referenceAnswer === null) {
    return '(aucune — question d\'abstention)';
  }

  return referenceAnswer;
}

function formatSources(sources: E2ESourceJudgeInput['sources']): string {
  if (sources.length === 0) {
    return '(aucune source)';
  }

  return sources
    .map(
      (source) =>
        [
          `Source ${source.sourceId}`,
          `articleNumber: ${source.articleNumber}`,
          `chunkId: ${source.chunkId}`,
          'content:',
          source.content,
        ].join('\n'),
    )
    .join('\n\n');
}

function formatJudgeResult(
  judgeResult: E2ESourceJudgeInput['judgeResult'],
): string {
  if (judgeResult === null) {
    return '(non disponible)';
  }

  return JSON.stringify(judgeResult, null, 2);
}

export function formatE2ESourceJudgeUserMessageContent(
  input: E2ESourceJudgeInput,
): string {
  return [
    `QUESTION:\n${input.question}`,
    `REFERENCE ANSWER:\n${formatReferenceAnswer(input.referenceAnswer)}`,
    `GENERATED ANSWER:\n${input.generatedAnswer}`,
    `EXPECTED ABSTENTION: ${input.expectedAbstention}`,
    `SOURCES:\n${formatSources(input.sources)}`,
    `JUDGE RESULT:\n${formatJudgeResult(input.judgeResult)}`,
  ].join('\n\n');
}

export function buildE2ESourceJudgePromptInput(input: E2ESourceJudgeInput) {
  return {
    question: input.question,
    referenceAnswer: formatReferenceAnswer(input.referenceAnswer),
    generatedAnswer: input.generatedAnswer,
    expectedAbstention: String(input.expectedAbstention),
    sources: formatSources(input.sources),
    judgeResult: formatJudgeResult(input.judgeResult),
  };
}

export function buildE2ESourceJudgeMessages(
  input: E2ESourceJudgeInput,
): ChatCompletionMessageParam[] {
  return [
    { role: 'system', content: E2E_SOURCE_JUDGE_SYSTEM_PROMPT },
    {
      role: 'user',
      content: formatE2ESourceJudgeUserMessageContent(input),
    },
  ];
}
