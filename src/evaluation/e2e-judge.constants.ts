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
