import type { PrismaService } from '../prisma/prisma.service.js';
import { DEFAULT_CODE_PENAL_CORPUS_ID } from './constants.js';
import { importCorpusEmbeddings } from './import-corpus-embeddings.js';
import type { ImportCodePenalOptions, ImportResult } from './types.js';

/** @deprecated Use importCorpusEmbeddings with corpusId "code-penal" */
export async function importCodePenal(
  prisma: PrismaService,
  options: ImportCodePenalOptions = {},
): Promise<ImportResult> {
  return importCorpusEmbeddings(prisma, DEFAULT_CODE_PENAL_CORPUS_ID, options);
}
