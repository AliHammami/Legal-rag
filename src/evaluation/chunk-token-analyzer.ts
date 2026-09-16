import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import type { Tiktoken } from 'tiktoken';
import { get_encoding } from 'tiktoken';

import { TARGET_SIZE, MAX_SIZE } from '../chunking/constants.js';
import type { PenalCodeChunk, PenalCodeChunkingResult } from '../chunking/types.js';
import { ALL_CORPUS_IDS, getCorpusConfig } from '../ingestion/corpus-config.js';
import { EvaluationError } from './evaluation.error.js';
import type {
  ChunkTokenAnalysisReport,
  ChunkTokenRecord,
  CorpusTokenAnalysis,
  CorpusTokenAnomaly,
  GlobalCorpusComparisonRow,
} from './chunk-token-analysis.types.js';
import {
  buildBucketCounts,
  buildThresholdCounts,
  charsPerToken,
  globalCharsPerToken,
  summarize,
  TOKEN_BUCKETS,
  TOKEN_THRESHOLDS,
} from './chunk-token-stats.js';

export const EMBEDDING_MODEL = 'text-embedding-3-large';
export const EMBEDDING_ENCODING = 'cl100k_base';

export interface CorpusChunkSource {
  id: string;
  codeName: string;
  path: string;
}

export function getCorpusChunkSources(): CorpusChunkSource[] {
  return ALL_CORPUS_IDS.map((id) => {
    const config = getCorpusConfig(id);
    return {
      id: config.corpusId,
      codeName: config.codeName,
      path: config.chunksOutputPath,
    };
  });
}

export function createEmbeddingTokenizer(): Tiktoken {
  return get_encoding(EMBEDDING_ENCODING);
}

export function countTokens(tokenizer: Tiktoken, content: string): number {
  return tokenizer.encode(content).length;
}

function assertChunkStructure(
  chunk: unknown,
  corpusId: string,
  index: number,
): asserts chunk is PenalCodeChunk {
  if (typeof chunk !== 'object' || chunk === null) {
    throw new EvaluationError(
      `Invalid chunk at index ${index} in ${corpusId}: expected object`,
      'CHUNK_TOKEN_ANALYSIS_INVALID',
    );
  }

  const candidate = chunk as Partial<PenalCodeChunk>;
  if (typeof candidate.content !== 'string') {
    throw new EvaluationError(
      `Chunk at index ${index} in ${corpusId} has non-string content`,
      'CHUNK_TOKEN_ANALYSIS_INVALID',
    );
  }
  if (typeof candidate.chunkId !== 'string' || candidate.chunkId.length === 0) {
    throw new EvaluationError(
      `Chunk at index ${index} in ${corpusId} is missing chunkId`,
      'CHUNK_TOKEN_ANALYSIS_INVALID',
    );
  }
}

function toChunkRecord(
  chunk: PenalCodeChunk,
  tokenCount: number,
  charCountMismatch: boolean,
): ChunkTokenRecord {
  const charCount = chunk.content.length;
  return {
    chunkId: chunk.chunkId,
    articleNumber: chunk.articleNumber,
    chunkIndex: chunk.metadata.chunkIndex,
    chunkCount: chunk.metadata.chunkCount,
    charCount,
    storedCharCount: charCountMismatch ? chunk.charCount : chunk.charCount,
    tokenCount,
    charsPerToken: charsPerToken(charCount, tokenCount),
  };
}

export async function loadCorpusChunks(
  source: CorpusChunkSource,
): Promise<PenalCodeChunkingResult> {
  const absolutePath = resolve(source.path);
  let raw: string;
  try {
    raw = await readFile(absolutePath, 'utf-8');
  } catch {
    throw new EvaluationError(
      `Chunks file not found: ${source.path}`,
      'CHUNK_TOKEN_ANALYSIS_NOT_FOUND',
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new EvaluationError(
      `Invalid JSON in chunks file: ${source.path}`,
      'CHUNK_TOKEN_ANALYSIS_INVALID',
      error,
    );
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !Array.isArray((parsed as PenalCodeChunkingResult).chunks)
  ) {
    throw new EvaluationError(
      `Chunks file must contain a chunks array: ${source.path}`,
      'CHUNK_TOKEN_ANALYSIS_INVALID',
    );
  }

  return parsed as PenalCodeChunkingResult;
}

export function analyzeCorpusChunks(
  source: CorpusChunkSource,
  chunks: PenalCodeChunk[],
  tokenizer: Tiktoken,
): CorpusTokenAnalysis {
  if (chunks.length === 0) {
    throw new EvaluationError(
      `Corpus ${source.id} has no chunks to analyze`,
      'CHUNK_TOKEN_ANALYSIS_EMPTY',
    );
  }

  const anomalies: CorpusTokenAnomaly[] = [];
  const records: ChunkTokenRecord[] = [];
  const seenChunkIds = new Map<string, number>();
  let charCountMismatches = 0;
  let duplicateChunkIds = 0;

  for (const [index, chunk] of chunks.entries()) {
    assertChunkStructure(chunk, source.id, index);

    if (chunk.content.length === 0) {
      throw new EvaluationError(
        `Chunk ${chunk.chunkId} in ${source.id} has empty content`,
        'CHUNK_TOKEN_ANALYSIS_INVALID',
      );
    }

    const charCount = chunk.content.length;
    const charCountMismatch = chunk.charCount !== charCount;
    if (charCountMismatch) {
      charCountMismatches++;
      anomalies.push({
        type: 'char_count_mismatch',
        message: `charCount=${chunk.charCount} but content.length=${charCount}`,
        chunkId: chunk.chunkId,
      });
    }

    const occurrence = (seenChunkIds.get(chunk.chunkId) ?? 0) + 1;
    seenChunkIds.set(chunk.chunkId, occurrence);
    if (occurrence > 1) {
      duplicateChunkIds++;
      anomalies.push({
        type: 'duplicate_chunk_id',
        message: `Duplicate chunkId (occurrence ${occurrence})`,
        chunkId: chunk.chunkId,
      });
    }

    const tokenCount = countTokens(tokenizer, chunk.content);
    if (tokenCount <= 0) {
      throw new EvaluationError(
        `Chunk ${chunk.chunkId} in ${source.id} has tokenCount=${tokenCount} for non-empty content`,
        'CHUNK_TOKEN_ANALYSIS_INVALID',
      );
    }

    if (!Number.isFinite(tokenCount)) {
      throw new EvaluationError(
        `Chunk ${chunk.chunkId} in ${source.id} has invalid tokenCount`,
        'CHUNK_TOKEN_ANALYSIS_INVALID',
      );
    }

    records.push(toChunkRecord(chunk, tokenCount, charCountMismatch));
  }

  const charCounts = records.map((record) => record.charCount);
  const tokenCounts = records.map((record) => record.tokenCount);
  const charsPerTokenValues = records.map((record) => record.charsPerToken);
  const totalCharacters = charCounts.reduce((sum, value) => sum + value, 0);
  const totalTokens = tokenCounts.reduce((sum, value) => sum + value, 0);

  const largestChunks = [...records]
    .sort((a, b) => b.tokenCount - a.tokenCount)
    .slice(0, 10);

  return {
    corpusId: source.id,
    codeName: source.codeName,
    chunksPath: source.path,
    chunkCount: records.length,
    totalCharacters,
    totalTokens,
    globalCharsPerToken: globalCharsPerToken(totalCharacters, totalTokens),
    characters: summarize(charCounts),
    tokens: summarize(tokenCounts),
    charsPerToken: summarize(charsPerTokenValues),
    tokenBuckets: buildBucketCounts(tokenCounts, TOKEN_BUCKETS),
    thresholds: buildThresholdCounts(tokenCounts, TOKEN_THRESHOLDS),
    largestChunks,
    anomalies,
    charCountMismatches,
    duplicateChunkIds,
  };
}

function buildComparisonRow(
  analysis: CorpusTokenAnalysis,
): GlobalCorpusComparisonRow {
  const threshold = (value: number) =>
    analysis.thresholds.find((entry) => entry.threshold === value) ?? {
      threshold: value,
      count: 0,
      percentage: 0,
    };

  return {
    corpusId: analysis.corpusId,
    codeName: analysis.codeName,
    chunkCount: analysis.chunkCount,
    avgChars: analysis.characters.mean,
    p50Chars: analysis.characters.p50,
    p95Chars: analysis.characters.p95,
    maxChars: analysis.characters.max,
    avgTokens: analysis.tokens.mean,
    p50Tokens: analysis.tokens.p50,
    p95Tokens: analysis.tokens.p95,
    p99Tokens: analysis.tokens.p99,
    maxTokens: analysis.tokens.max,
    avgCharsPerToken: analysis.charsPerToken.mean,
    globalCharsPerToken: analysis.globalCharsPerToken,
    gte1000Tokens: threshold(1000),
    gte1500Tokens: threshold(1500),
    gte2000Tokens: threshold(2000),
    gte2500Tokens: threshold(2500),
  };
}

export async function analyzeAllCorpusChunkTokens(
  tokenizer: Tiktoken = createEmbeddingTokenizer(),
): Promise<ChunkTokenAnalysisReport> {
  const sources = getCorpusChunkSources();
  const corpora: Record<string, CorpusTokenAnalysis> = {};

  for (const source of sources) {
    const file = await loadCorpusChunks(source);
    corpora[source.id] = analyzeCorpusChunks(source, file.chunks, tokenizer);
  }

  const analyses = Object.values(corpora);
  const totalChunks = analyses.reduce(
    (sum, analysis) => sum + analysis.chunkCount,
    0,
  );
  const totalCharacters = analyses.reduce(
    (sum, analysis) => sum + analysis.totalCharacters,
    0,
  );
  const totalTokens = analyses.reduce(
    (sum, analysis) => sum + analysis.totalTokens,
    0,
  );

  return {
    generatedAt: new Date().toISOString(),
    tokenizer: {
      name: 'tiktoken',
      encoding: EMBEDDING_ENCODING,
      model: EMBEDDING_MODEL,
    },
    configuration: {
      targetChars: TARGET_SIZE,
      maxChars: MAX_SIZE,
    },
    corpora,
    global: {
      corpusCount: analyses.length,
      totalChunks,
      totalCharacters,
      totalTokens,
      averageTokensPerChunk:
        totalChunks === 0
          ? 0
          : Number((totalTokens / totalChunks).toFixed(2)),
      globalCharsPerToken: globalCharsPerToken(totalCharacters, totalTokens),
      comparison: analyses.map(buildComparisonRow),
    },
  };
}
