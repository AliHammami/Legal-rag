import { z } from 'zod';

import { ALL_CORPUS_IDS } from '../ingestion/corpus-config.js';

/** Sortie LLM routing — alignée sur l'ancien `ROUTING_RESPONSE_SCHEMA` (strict). */
export const RoutingLlmResponseSchema = z.object({
  corpusIds: z.array(
    z.enum(ALL_CORPUS_IDS as [string, ...string[]]),
  ),
});

export type RoutingLlmResponse = z.infer<typeof RoutingLlmResponseSchema>;
