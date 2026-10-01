import { z } from 'zod';

const e2eJudgeScoreSchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
]);

/** Sortie LLM judge E2E � align?e sur l'ancien `E2E_JUDGE_RESPONSE_SCHEMA`. */
export const E2EJudgeLlmResponseSchema = z.object({
  correctness: e2eJudgeScoreSchema,
  completeness: e2eJudgeScoreSchema,
  groundedness: e2eJudgeScoreSchema,
  abstentionCorrect: z.boolean(),
  explanation: z.string(),
});

export type E2EJudgeLlmResponse = z.infer<typeof E2EJudgeLlmResponseSchema>;
