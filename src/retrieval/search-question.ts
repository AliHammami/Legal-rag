import type { OpenAIService } from '../openai/openai.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { RetrievalError } from './retrieval.error.js';
import { searchSimilarChunks } from './search-similar-chunks.js';
import type { SearchQuestionOptions, SimilarChunk } from './types.js';
import { validateQuestion } from './validate-search-input.js';

export async function searchQuestion(
  prisma: PrismaService,
  openAIService: OpenAIService,
  question: string,
  topK: number,
  options: SearchQuestionOptions = {},
): Promise<SimilarChunk[]> {
  const normalizedQuestion = validateQuestion(question);

  const embeddingResults = await openAIService.createEmbeddings([
    normalizedQuestion,
  ]);

  const queryEmbedding = embeddingResults[0]?.embedding;
  if (!queryEmbedding) {
    throw new RetrievalError(
      'OpenAI returned no embedding for the question',
      'EMBEDDING_MISSING',
    );
  }

  return searchSimilarChunks(prisma, queryEmbedding, topK, options);
}
