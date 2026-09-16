import { EMBEDDING_DIMENSIONS } from '../embeddings/constants.js';
import { formatVectorLiteral } from '../persistence/format-vector.js';
import { LEGAL_CODE_CHUNKS_TABLE } from '../persistence/constants.js';
import { RETRIEVAL_CORPUS_ID } from './constants.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { mapSearchResults } from './map-search-result.js';
import type { SearchSimilarChunksOptions, SimilarChunk, SimilarChunkRow } from './types.js';
import {
  validateQueryEmbedding,
  validateTopK,
} from './validate-search-input.js';

const SEARCH_SIMILAR_SQL = `
  SELECT
    chunk_id,
    article_number,
    content,
    metadata,
    embedding <=> $1::vector(3072) AS distance
  FROM ${LEGAL_CODE_CHUNKS_TABLE}
  WHERE corpus_id = $3
  ORDER BY embedding <=> $1::vector(3072) ASC
  LIMIT $2
`;

export async function searchSimilarChunks(
  prisma: PrismaService,
  queryEmbedding: number[],
  topK: number,
  options: SearchSimilarChunksOptions = {},
): Promise<SimilarChunk[]> {
  const expectedDimensions = options.expectedDimensions ?? EMBEDDING_DIMENSIONS;

  validateTopK(topK);
  validateQueryEmbedding(queryEmbedding, expectedDimensions);

  const vectorLiteral = formatVectorLiteral(queryEmbedding, expectedDimensions);
  const rows = await prisma.$queryRawUnsafe<SimilarChunkRow[]>(
    SEARCH_SIMILAR_SQL,
    vectorLiteral,
    topK,
    RETRIEVAL_CORPUS_ID,
  );

  return mapSearchResults(rows);
}
