import { open } from 'node:fs/promises';

import { DEFAULT_BATCH_SIZE } from '../embeddings/constants.js';
import type { EmbeddingConfig } from '../embeddings/types.js';
import { PersistenceError } from './persistence.error.js';

export interface EmbeddingsFileMetadata {
  embeddedAt: string;
  config: EmbeddingConfig;
}

function parseMetadataFromHead(head: string): EmbeddingsFileMetadata {
  const embeddedAtMatch = head.match(/"embeddedAt"\s*:\s*"([^"]+)"/);
  const modelMatch = head.match(/"model"\s*:\s*"([^"]+)"/);
  const dimensionsMatch = head.match(/"dimensions"\s*:\s*(\d+)/);
  const batchSizeMatch = head.match(/"batchSize"\s*:\s*(\d+)/);

  if (!embeddedAtMatch || !modelMatch || !dimensionsMatch) {
    throw new PersistenceError(
      'Unable to parse embeddings file metadata',
      'EMBEDDINGS_FILE_INVALID',
    );
  }

  return {
    embeddedAt: embeddedAtMatch[1]!,
    config: {
      model: modelMatch[1]!,
      dimensions: Number(dimensionsMatch[1]),
      batchSize: batchSizeMatch
        ? Number(batchSizeMatch[1])
        : DEFAULT_BATCH_SIZE,
    },
  };
}

export async function readEmbeddingsFileMetadata(
  embeddingsPath: string,
): Promise<EmbeddingsFileMetadata> {
  const handle = await open(embeddingsPath, 'r');
  try {
    const buffer = Buffer.alloc(16_384);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    return parseMetadataFromHead(buffer.toString('utf-8', 0, bytesRead));
  } finally {
    await handle.close();
  }
}
