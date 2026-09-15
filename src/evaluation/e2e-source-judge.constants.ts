export const E2E_SOURCE_JUDGE_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    sourceRelevance: {
      type: 'integer',
      enum: [0, 1, 2, 3, 4],
    },
    sourceCoverage: {
      type: 'integer',
      enum: [0, 1, 2, 3, 4],
    },
    explanation: {
      type: 'string',
    },
  },
  required: ['sourceRelevance', 'sourceCoverage', 'explanation'],
  additionalProperties: false,
} as const;
