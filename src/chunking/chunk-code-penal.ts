import type { PenalCodeChunkingResult } from './types.js';
import { chunkCorpus, type ChunkCorpusOptions } from './chunk-corpus.js';

export interface ChunkCodePenalOptions
  extends Omit<ChunkCorpusOptions, 'corpusId'> {}

const DEFAULT_ARTICLES = 'data/processed/code-penal.articles.json';
const DEFAULT_OUTPUT = 'data/processed/code-penal.chunks.json';
const DEFAULT_REPORT = 'data/processed/chunking-report.json';

export async function chunkCodePenal(
  options: ChunkCodePenalOptions = {},
): Promise<PenalCodeChunkingResult> {
  return chunkCorpus({
    corpusId: 'code-penal',
    articlesPath: options.articlesPath ?? DEFAULT_ARTICLES,
    outputPath: options.outputPath ?? DEFAULT_OUTPUT,
    reportPath: options.reportPath ?? DEFAULT_REPORT,
    targetSize: options.targetSize,
    maxSize: options.maxSize,
  });
}

export { chunkCorpus } from './chunk-corpus.js';
