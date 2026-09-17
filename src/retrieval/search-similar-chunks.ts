import { EMBEDDING_DIMENSIONS } from '../embeddings/constants.js';
import { formatVectorLiteral } from '../persistence/format-vector.js';
import { LEGAL_CODE_CHUNKS_TABLE } from '../persistence/constants.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { mapSearchResults } from './map-search-result.js';
import type { SearchSimilarChunksOptions, SimilarChunk, SimilarChunkRow } from './types.js';
import { validateCorpusIds } from './validate-corpus-ids.js';
import {
  validateQueryEmbedding,
  validateTopK,
} from './validate-search-input.js';

const SEARCH_SELECT = `
  SELECT
    corpus_id,
    chunk_id,
    article_number,
    content,
    metadata,
    embedding <=> $1::vector(3072) AS distance
  FROM ${LEGAL_CODE_CHUNKS_TABLE}
`;

function buildSearchQuery(corpusIds?: string[]): {
  sql: string;
  corpusParam?: string | string[];
} {
  if (corpusIds === undefined) {
    return {
      sql: `${SEARCH_SELECT}
  ORDER BY embedding <=> $1::vector(3072) ASC
  LIMIT $2`,
    };
  }

  if (corpusIds.length === 1) {
    return {
      sql: `${SEARCH_SELECT}
  WHERE corpus_id = $3
  ORDER BY embedding <=> $1::vector(3072) ASC
  LIMIT $2`,
      corpusParam: corpusIds[0]!,
    };
  }

  return {
    sql: `${SEARCH_SELECT}
  WHERE corpus_id = ANY($3::text[])
  ORDER BY embedding <=> $1::vector(3072) ASC
  LIMIT $2`,
    corpusParam: corpusIds,
  };
}

export async function searchSimilarChunks(
  prisma: PrismaService,
  queryEmbedding: number[],
  topK: number,
  options: SearchSimilarChunksOptions = {},
): Promise<SimilarChunk[]> {
  const expectedDimensions = options.expectedDimensions ?? EMBEDDING_DIMENSIONS;
  const corpusIds = validateCorpusIds(options.corpusIds);

  validateTopK(topK);
  validateQueryEmbedding(queryEmbedding, expectedDimensions);

  const vectorLiteral = formatVectorLiteral(queryEmbedding, expectedDimensions);
  const { sql, corpusParam } = buildSearchQuery(corpusIds);
  const params =
    corpusParam === undefined
      ? [vectorLiteral, topK]
      : [vectorLiteral, topK, corpusParam];

  const rows = await prisma.$queryRawUnsafe<SimilarChunkRow[]>(sql, ...params);

  return mapSearchResults(rows);
}
