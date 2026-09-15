export const RAG_EVALUATION_JUDGE_MODEL_ENV = 'RAG_EVALUATION_JUDGE_MODEL';

export const DEFAULT_RAG_EVALUATION_JUDGE_MODEL = 'gpt-5.6-luna';

export const E2E_JUDGE_CRITERIA = [
  'correctness',
  'completeness',
  'groundedness',
  'abstention',
] as const;

export const E2E_JUDGE_SCORE_MIN = 0;

export const E2E_JUDGE_SCORE_MAX = 4;

export const E2E_JUDGE_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    correctness: {
      type: 'integer',
      enum: [0, 1, 2, 3, 4],
    },
    completeness: {
      type: 'integer',
      enum: [0, 1, 2, 3, 4],
    },
    groundedness: {
      type: 'integer',
      enum: [0, 1, 2, 3, 4],
    },
    abstentionCorrect: {
      type: 'boolean',
    },
    explanation: {
      type: 'string',
    },
  },
  required: [
    'correctness',
    'completeness',
    'groundedness',
    'abstentionCorrect',
    'explanation',
  ],
  additionalProperties: false,
} as const;
