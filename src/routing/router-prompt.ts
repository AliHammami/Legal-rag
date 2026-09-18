import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

import type { CorpusRoutingDescription } from './types.js';

function formatCorpusList(corpora: readonly CorpusRoutingDescription[]): string {
  return corpora
    .map((corpus) => `- ${corpus.id} (${corpus.codeName}) : ${corpus.description}`)
    .join('\n');
}

export function buildRouterMessages(
  question: string,
  corpora: readonly CorpusRoutingDescription[],
): ChatCompletionMessageParam[] {
  return [
    {
      role: 'system',
      content: `Tu es un routeur juridique. Tu dois s?lectionner le ou les corpus pertinents pour r?pondre ? une question utilisateur.

Corpus disponibles (utilise uniquement ces IDs exacts dans corpusIds) :
${formatCorpusList(corpora)}

R?gles :
- Retourne uniquement les corpus r?ellement pertinents pour la question.
- N'invente aucun corpusId.
- Si plusieurs corpus sont clairement n?cessaires, liste-les tous.
- Si la question est trop vague, trop g?n?rale ou ne permet pas de d?terminer un corpus avec confiance raisonnable, retourne {"corpusIds": []}.
- Ne force pas un corpus unique lorsque la question couvre clairement plusieurs domaines juridiques distincts.
- R?ponds uniquement avec le JSON demand?.`,
    },
    {
      role: 'user',
      content: question,
    },
  ];
}
