import type { OpenAIEmbeddings } from '@langchain/openai';

import type { CreateEmbeddingsResult } from './types.js';

export async function embedDocumentsIndexed(
  embeddingsModel: OpenAIEmbeddings,
  inputs: string[],
): Promise<CreateEmbeddingsResult[]> {
  const vectors = await embeddingsModel.embedDocuments(inputs);
  return vectors.map((embedding, index) => ({
    index,
    embedding,
  }));
}
