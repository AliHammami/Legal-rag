import { ALL_CORPUS_IDS } from '../ingestion/corpus-config.js';

export const DEFAULT_ROUTING_MODEL = 'gpt-5.6-luna';

export const ROUTING_MODEL_ENV = 'ROUTING_MODEL';

export const ROUTING_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    corpusIds: {
      type: 'array',
      items: {
        type: 'string',
        enum: [...ALL_CORPUS_IDS],
      },
    },
  },
  required: ['corpusIds'],
  additionalProperties: false,
} as const;
