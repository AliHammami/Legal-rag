export const RERANKING_MODEL = 'gpt-5-nano';

export const DEFAULT_RETRIEVAL_TOP_K = 20;
export const DEFAULT_RERANK_TOP_K = 5;
export const MAX_RERANK_ATTEMPTS = 2;

export const RERANK_RESPONSE_SCHEMA_NAME = 'ranked_chunks';

export const RERANK_RESPONSE_JSON_SCHEMA = {
  type: 'object',
  properties: {
    rankedChunks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          chunkId: { type: 'string' },
        },
        required: ['chunkId'],
        additionalProperties: false,
      },
    },
  },
  required: ['rankedChunks'],
  additionalProperties: false,
} as const;
