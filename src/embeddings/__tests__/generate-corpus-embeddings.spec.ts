import { access, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { EMBEDDING_DIMENSIONS } from '../constants.js';
import { generateCorpusEmbeddings } from '../generate-corpus-embeddings.js';
import { embedCodePenal } from '../embed-code-penal.js';
import type { PenalCodeChunkingResult } from '../../chunking/types.js';
import type { OpenAIService } from '../../openai/openai.service.js';
import { EmbeddingPipelineError } from '../embedding-pipeline.error.js';

function vector(seed: number): number[] {
  return Array.from({ length: EMBEDDING_DIMENSIONS }, (_, i) => seed + i * 0.0001);
}

function makeFixture(corpusId = 'code-penal'): PenalCodeChunkingResult {
  return {
    corpusId,
    codeName: corpusId,
    source: {
      articlesFile: `data/processed/${corpusId}.articles.json`,
      articleCount: 2,
    },
    chunkedAt: '2026-01-01T00:00:00.000Z',
    config: { targetSize: 1500, maxSize: 2000 },
    stats: {
      articleCount: 2,
      chunkCount: 3,
      singleChunkArticles: 1,
      multiChunkArticles: 1,
      maxChunkSize: 100,
      avgChunkSize: 50,
      chunksOverMax: 0,
      sentenceSplitUnits: 0,
      hardSplitUnits: 0,
    },
    chunks: [
      {
        chunkId: '111-1#0',
        articleNumber: '111-1',
        content: 'Premier chunk',
        charCount: 13,
        metadata: {
          articleNumber: '111-1',
          pageStart: 1,
          pageEnd: 1,
          source: 'data/test.pdf',
          sourceType: 'pdf',
          chunkIndex: 0,
          chunkCount: 1,
          unitStart: 0,
          unitEnd: 0,
          unitCount: 1,
        },
      },
      {
        chunkId: '131-6#0',
        articleNumber: '131-6',
        content: 'Deuxi\u00E8me chunk',
        charCount: 14,
        metadata: {
          articleNumber: '131-6',
          pageStart: 2,
          pageEnd: 2,
          source: 'data/test.pdf',
          sourceType: 'pdf',
          chunkIndex: 0,
          chunkCount: 2,
          unitStart: 0,
          unitEnd: 1,
          unitCount: 2,
        },
      },
      {
        chunkId: '131-6#1',
        articleNumber: '131-6',
        content: 'Troisi\u00E8me chunk',
        charCount: 15,
        metadata: {
          articleNumber: '131-6',
          pageStart: 2,
          pageEnd: 2,
          source: 'data/test.pdf',
          sourceType: 'pdf',
          chunkIndex: 1,
          chunkCount: 2,
          unitStart: 2,
          unitEnd: 2,
          unitCount: 3,
        },
      },
    ],
  };
}

describe('generateCorpusEmbeddings (mock OpenAI)', () => {
  let tempDir: string;
  let batchCounter: number;

  const mockOpenAIService = {
    createEmbeddings: vi.fn(),
    getEmbeddingModel: vi.fn(() => 'text-embedding-3-large'),
  } as unknown as OpenAIService;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'embed-corpus-test-'));
    batchCounter = 0;
    vi.mocked(mockOpenAIService.createEmbeddings).mockImplementation(
      async (inputs: string[]) => {
        batchCounter++;
        return inputs.map((_, index) => ({
          index,
          embedding: vector(batchCounter * 10 + index),
        }));
      },
    );
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  async function writeFixture(
    corpusId: string,
    fixture: PenalCodeChunkingResult,
  ): Promise<string> {
    const chunksPath = join(tempDir, `${corpusId}.chunks.json`);
    await writeFile(chunksPath, JSON.stringify(fixture), 'utf-8');
    return chunksPath;
  }

  it('produit un JSON multi-corpus avec corpusId explicite', async () => {
    const chunksPath = await writeFixture('code-civil', makeFixture('code-civil'));
    const outputPath = join(tempDir, 'code-civil.embeddings.json');

    const result = await generateCorpusEmbeddings(mockOpenAIService, 'code-civil', {
      chunksPath,
      outputPath,
      batchSize: 2,
    });

    expect(result.corpusId).toBe('code-civil');
    expect(result.stats.inputChunkCount).toBe(3);
    expect(result.stats.outputRecordCount).toBe(3);
    expect(result.records.every((record) => record.corpusId === 'code-civil')).toBe(
      true,
    );
    expect(result.records[0]!.embedding).toHaveLength(3072);

    const written = JSON.parse(await readFile(outputPath, 'utf-8'));
    expect(written.records).toHaveLength(3);
    expect(written.corpusId).toBe('code-civil');
  });

  it('mappe correctement m\u00EAme si l API retourne les indices permut\u00E9s', async () => {
    vi.mocked(mockOpenAIService.createEmbeddings).mockImplementationOnce(
      async (inputs: string[]) =>
        inputs.map((_, index) => ({
          index: inputs.length - 1 - index,
          embedding: vector(100 + index),
        })),
    );

    const fixture = makeFixture('code-penal');
    fixture.chunks = [fixture.chunks[0]!];
    fixture.stats.chunkCount = 1;
    const chunksPath = await writeFixture('code-penal-permute', fixture);
    const outputPath = join(tempDir, 'permute.embeddings.json');

    const result = await generateCorpusEmbeddings(
      mockOpenAIService,
      'code-penal',
      {
        chunksPath,
        outputPath,
        batchSize: 128,
      },
    );

    expect(result.records[0]!.chunkId).toBe('111-1#0');
    expect(result.records[0]!.content).toBe('Premier chunk');
  });

  it('rejette un mismatch input/output API', async () => {
    vi.mocked(mockOpenAIService.createEmbeddings).mockImplementationOnce(
      async () => [{ index: 0, embedding: vector(1) }],
    );

    const chunksPath = await writeFixture('code-penal-mismatch', makeFixture());
    await expect(
      generateCorpusEmbeddings(mockOpenAIService, 'code-penal', {
        chunksPath,
        outputPath: join(tempDir, 'mismatch.embeddings.json'),
        batchSize: 128,
      }),
    ).rejects.toThrow(/Expected 3 embeddings/);
  });

  it('rejette un corpus inconnu', async () => {
    await expect(
      generateCorpusEmbeddings(mockOpenAIService, 'code-inconnu', {
        chunksPath: join(tempDir, 'missing.chunks.json'),
        outputPath: join(tempDir, 'missing.embeddings.json'),
      }),
    ).rejects.toThrow(/Corpus inconnu/);
  });

  it('rejette un fichier chunks absent', async () => {
    await expect(
      generateCorpusEmbeddings(mockOpenAIService, 'code-civil', {
        chunksPath: join(tempDir, 'absent.chunks.json'),
        outputPath: join(tempDir, 'absent.embeddings.json'),
      }),
    ).rejects.toThrow(/Chunks file not found/);
  });

  it('rejette des chunkIds dupliqu\u00E9s dans la source', async () => {
    const fixture = makeFixture('code-civil');
    fixture.chunks = [fixture.chunks[0]!, { ...fixture.chunks[0]! }];
    const chunksPath = await writeFixture('code-civil-dup', fixture);

    await expect(
      generateCorpusEmbeddings(mockOpenAIService, 'code-civil', {
        chunksPath,
        outputPath: join(tempDir, 'dup.embeddings.json'),
      }),
    ).rejects.toThrow(/Duplicate chunkId/);
  });

  it('ne remplace pas le fichier existant si la g\u00E9n\u00E9ration \u00E9choue', async () => {
    const chunksPath = await writeFixture('code-penal-atomic', makeFixture());
    const outputPath = join(tempDir, 'atomic.embeddings.json');
    await writeFile(outputPath, JSON.stringify({ preserved: true }), 'utf-8');
    const before = await stat(outputPath);

    vi.mocked(mockOpenAIService.createEmbeddings).mockRejectedValueOnce(
      new Error('API down'),
    );

    await expect(
      generateCorpusEmbeddings(mockOpenAIService, 'code-penal', {
        chunksPath,
        outputPath,
      }),
    ).rejects.toThrow(EmbeddingPipelineError);

    const preserved = JSON.parse(await readFile(outputPath, 'utf-8'));
    expect(preserved.preserved).toBe(true);
    expect((await stat(outputPath)).mtimeMs).toBe(before.mtimeMs);
  });

  it('utilise le m\u00EAme pipeline via embedCodePenal', async () => {
    const chunksPath = await writeFixture('code-penal-wrapper', makeFixture());
    const outputPath = join(tempDir, 'wrapper.embeddings.json');

    const result = await embedCodePenal(mockOpenAIService, {
      chunksPath,
      outputPath,
      batchSize: 128,
    });

    expect(result.corpusId).toBe('code-penal');
    expect(result.records).toHaveLength(3);
    await access(outputPath);
  });
});

describe('loadChunksSource validations', () => {
  it('rejette un corpusId diff\u00E9rent dans le fichier chunks', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'embed-corpus-mismatch-'));
    try {
      const fixture = makeFixture('code-civil');
      const chunksPath = join(tempDir, 'chunks.json');
      await writeFile(chunksPath, JSON.stringify(fixture), 'utf-8');

      await expect(
        generateCorpusEmbeddings(
          {
            createEmbeddings: vi.fn(),
            getEmbeddingModel: vi.fn(() => 'text-embedding-3-large'),
          } as unknown as OpenAIService,
          'code-penal',
          { chunksPath, outputPath: join(tempDir, 'out.json') },
        ),
      ).rejects.toThrow(EmbeddingPipelineError);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
