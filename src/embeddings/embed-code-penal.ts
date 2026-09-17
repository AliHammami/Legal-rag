import type { OpenAIService } from '../openai/openai.service.js';
import {
  DEFAULT_CHUNKS_FILE,
  DEFAULT_OUTPUT_FILE,
  DEFAULT_REPORT_FILE,
} from './constants.js';
import {
  generateCorpusEmbeddings,
  type GenerateCorpusEmbeddingsOptions,
} from './generate-corpus-embeddings.js';
import type { CorpusEmbeddingResult } from './types.js';

/** @deprecated Use GenerateCorpusEmbeddingsOptions */
export type EmbedCodePenalOptions = GenerateCorpusEmbeddingsOptions;

/** @deprecated Use CorpusEmbeddingResult */
export type { CorpusEmbeddingResult as PenalCodeEmbeddingResult };

export async function embedCodePenal(
  openAIService: OpenAIService,
  options: EmbedCodePenalOptions = {},
): Promise<CorpusEmbeddingResult> {
  return generateCorpusEmbeddings(openAIService, 'code-penal', {
    chunksPath: options.chunksPath ?? DEFAULT_CHUNKS_FILE,
    outputPath: options.outputPath ?? DEFAULT_OUTPUT_FILE,
    reportPath: options.reportPath ?? DEFAULT_REPORT_FILE,
    batchSize: options.batchSize,
    embeddingModel: options.embeddingModel,
  });
}
