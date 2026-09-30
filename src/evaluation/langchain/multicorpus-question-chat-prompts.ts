import { ChatPromptTemplate } from '@langchain/core/prompts';

export const MULTICORPUS_SINGLE_CORPUS_SYSTEM_PROMPT =
  'Tu es un juriste expert qui construit des datasets d ?valuation RAG strictement ancr?s dans les textes fournis.';

export const MULTICORPUS_MULTI_CORPUS_SYSTEM_PROMPT =
  'Tu es un juriste expert qui construit des datasets d ?valuation RAG multi-corpus strictement ancr?s dans les textes fournis.';

/** Corps user entier (articles / sc?narios) — m?me texte que buildSingleCorpusPrompt / buildMultiCorpusPrompt. */
export const MULTICORPUS_USER_CONTENT_TEMPLATE = '{userContent}';

export const MULTICORPUS_SINGLE_CORPUS_CHAT_PROMPT = ChatPromptTemplate.fromMessages([
  ['system', MULTICORPUS_SINGLE_CORPUS_SYSTEM_PROMPT],
  ['human', MULTICORPUS_USER_CONTENT_TEMPLATE],
]);

export const MULTICORPUS_MULTI_CORPUS_CHAT_PROMPT = ChatPromptTemplate.fromMessages([
  ['system', MULTICORPUS_MULTI_CORPUS_SYSTEM_PROMPT],
  ['human', MULTICORPUS_USER_CONTENT_TEMPLATE],
]);
