import { z } from 'zod';

/** Sortie LLM génération dataset — alignée sur l'ancien `GENERATED_QUESTION_SCHEMA`. */
export const MulticorpusGeneratedQuestionItemSchema = z.object({
  question: z.string(),
  goldCorpusIds: z.array(z.string()),
  goldArticles: z.array(z.string()),
  referenceAnswer: z.string(),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  questionType: z.enum(['single-corpus', 'multi-corpus']),
  sourceArticles: z.array(z.string()),
});

export const MulticorpusGeneratedQuestionsSchema = z.object({
  questions: z.array(MulticorpusGeneratedQuestionItemSchema),
});

export type MulticorpusGeneratedQuestions = z.infer<
  typeof MulticorpusGeneratedQuestionsSchema
>;
