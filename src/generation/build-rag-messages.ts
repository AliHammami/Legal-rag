import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

export const RAG_SYSTEM_PROMPT = `Tu es un assistant spécialisé dans le Code pénal français.

Réponds uniquement à partir du contexte fourni.

Si le contexte ne permet pas de répondre suffisamment, indique-le clairement.

N'invente aucune information absente du contexte.

Ne présente pas tes connaissances générales comme provenant du contexte.

Réponds de manière claire et concise.`;

export function buildRagMessages(
  question: string,
  context: string,
): ChatCompletionMessageParam[] {
  return [
    { role: 'system', content: RAG_SYSTEM_PROMPT },
    {
      role: 'user',
      content: `CONTEXTE:\n${context}\n\nQUESTION:\n${question}`,
    },
  ];
}
