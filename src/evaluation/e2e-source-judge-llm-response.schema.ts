import { z } from 'zod';

const e2eSourceJudgeScoreSchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
]);

/** Sortie LLM source judge � align?e sur l'ancien `E2E_SOURCE_JUDGE_RESPONSE_SCHEMA`. */
export const E2ESourceJudgeLlmResponseSchema = z.object({
  sourceRelevance: e2eSourceJudgeScoreSchema,
  sourceCoverage: e2eSourceJudgeScoreSchema,
  explanation: z.string(),
});

export type E2ESourceJudgeLlmResponse = z.infer<
  typeof E2ESourceJudgeLlmResponseSchema
>;
