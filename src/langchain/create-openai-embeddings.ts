import { OpenAIEmbeddings } from '@langchain/openai';

import {
  DEFAULT_EMBEDDING_MODEL,
  EMBEDDING_DIMENSIONS,
} from '../embeddings/constants.js';

export interface CreateOpenAIEmbeddingsOptions {
  apiKey: string;
  model?: string;
}

/** Align? sur l'ancien client OpenAI : dimensions 3072, float, pas de stripNewLines. */
export function createOpenAIEmbeddings(
  options: CreateOpenAIEmbeddingsOptions,
): OpenAIEmbeddings {
  return new OpenAIEmbeddings({
    apiKey: options.apiKey,
    model: options.model ?? DEFAULT_EMBEDDING_MODEL,
    dimensions: EMBEDDING_DIMENSIONS,
    encodingFormat: 'float',
    stripNewLines: false,
  });
}
