import type { PrismaService } from '../prisma/prisma.service.js';
import type { PenalCodeEmbeddedChunk } from '../embeddings/types.js';
import { formatVectorLiteral } from './format-vector.js';
import { PENAL_CODE_CHUNKS_TABLE } from './constants.js';

export interface UpsertChunkInput {
  record: PenalCodeEmbeddedChunk;
  embeddingModel: string;
  embeddedAt: Date;
}

const UPSERT_CONFLICT_SET = `
  article_number = EXCLUDED.article_number,
  content = EXCLUDED.content,
  char_count = EXCLUDED.char_count,
  metadata = EXCLUDED.metadata,
  embedding = EXCLUDED.embedding,
  embedding_model = EXCLUDED.embedding_model,
  embedded_at = EXCLUDED.embedded_at,
  imported_at = CURRENT_TIMESTAMP
`;

function buildBatchUpsertSql(batchSize: number): string {
  const valuePlaceholders = Array.from({ length: batchSize }, (_, rowIndex) => {
    const base = rowIndex * 8 + 1;
    return `($${base}, $${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}::jsonb, $${base + 5}::vector(3072), $${base + 6}, $${base + 7})`;
  });

  return `
    INSERT INTO ${PENAL_CODE_CHUNKS_TABLE} (
      chunk_id,
      article_number,
      content,
      char_count,
      metadata,
      embedding,
      embedding_model,
      embedded_at
    )
    VALUES ${valuePlaceholders.join(', ')}
    ON CONFLICT (chunk_id) DO UPDATE SET
      ${UPSERT_CONFLICT_SET}
  `;
}

function toBatchValues(batch: UpsertChunkInput[]): unknown[] {
  const values: unknown[] = [];

  for (const item of batch) {
    values.push(
      item.record.chunkId,
      item.record.articleNumber,
      item.record.content,
      item.record.charCount,
      JSON.stringify(item.record.metadata),
      formatVectorLiteral(item.record.embedding),
      item.embeddingModel,
      item.embeddedAt,
    );
  }

  return values;
}

export async function upsertChunkBatch(
  prisma: PrismaService,
  batch: UpsertChunkInput[],
): Promise<void> {
  if (batch.length === 0) {
    return;
  }

  const sql = buildBatchUpsertSql(batch.length);
  const values = toBatchValues(batch);

  await prisma.$executeRawUnsafe(sql, ...values);
}
