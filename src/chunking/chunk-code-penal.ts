import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { MAX_SIZE, TARGET_SIZE } from './constants.js';
import { chunkArticle } from './group-chunks.js';
import { segmentUnits } from './segment-units.js';
import type {
  PenalCodeChunkingResult,
  PenalCodeChunkingStats,
} from './types.js';
import type { PenalCodeIngestionResult } from '../ingestion/types.js';

export interface ChunkCodePenalOptions {
  articlesPath?: string;
  outputPath?: string;
  reportPath?: string;
  targetSize?: number;
  maxSize?: number;
}

const DEFAULT_ARTICLES = 'data/processed/code-penal.articles.json';
const DEFAULT_OUTPUT = 'data/processed/code-penal.chunks.json';
const DEFAULT_REPORT = 'data/processed/chunking-report.json';

function computeStats(
  ingestion: PenalCodeIngestionResult,
  chunks: PenalCodeChunkingResult['chunks'],
  maxSize: number,
): PenalCodeChunkingStats {
  const articleChunkCounts = new Map<string, number>();
  for (const chunk of chunks) {
    articleChunkCounts.set(
      chunk.articleNumber,
      (articleChunkCounts.get(chunk.articleNumber) ?? 0) + 1,
    );
  }

  const multiChunkArticles = [...articleChunkCounts.values()].filter(
    (count) => count > 1,
  ).length;

  const sizes = chunks.map((chunk) => chunk.charCount);
  const maxChunkSize = sizes.length > 0 ? Math.max(...sizes) : 0;
  const avgChunkSize =
    sizes.length > 0
      ? Math.round(sizes.reduce((sum, size) => sum + size, 0) / sizes.length)
      : 0;

  let sentenceSplitUnits = 0;
  let hardSplitUnits = 0;
  for (const article of ingestion.articles) {
    for (const unit of segmentUnits(article.content)) {
      if (unit.text.length <= maxSize) {
        continue;
      }
      const sentenceParts =
        unit.text.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g) ?? [unit.text];
      if (sentenceParts.every((part) => part.length <= maxSize)) {
        sentenceSplitUnits++;
      } else {
        hardSplitUnits++;
      }
    }
  }

  return {
    articleCount: ingestion.articles.length,
    chunkCount: chunks.length,
    singleChunkArticles: ingestion.articles.length - multiChunkArticles,
    multiChunkArticles,
    maxChunkSize,
    avgChunkSize,
    chunksOverMax: chunks.filter((chunk) => chunk.charCount > maxSize).length,
    sentenceSplitUnits,
    hardSplitUnits,
  };
}

export async function chunkCodePenal(
  options: ChunkCodePenalOptions = {},
): Promise<PenalCodeChunkingResult> {
  const startedAt = Date.now();
  const articlesPath = resolve(options.articlesPath ?? DEFAULT_ARTICLES);
  const outputPath = resolve(options.outputPath ?? DEFAULT_OUTPUT);
  const reportPath = resolve(options.reportPath ?? DEFAULT_REPORT);
  const targetSize = options.targetSize ?? TARGET_SIZE;
  const maxSize = options.maxSize ?? MAX_SIZE;

  const raw = await readFile(articlesPath, 'utf-8');
  const ingestion = JSON.parse(raw) as PenalCodeIngestionResult;

  const chunks = ingestion.articles.flatMap((article) =>
    chunkArticle(article, targetSize, maxSize),
  );

  const stats = computeStats(ingestion, chunks, maxSize);

  const result: PenalCodeChunkingResult = {
    source: {
      articlesFile: options.articlesPath ?? DEFAULT_ARTICLES,
      ingestionExtractedAt: ingestion.extractedAt,
      articleCount: ingestion.articles.length,
    },
    chunkedAt: new Date().toISOString(),
    config: { targetSize, maxSize },
    stats,
    chunks,
  };

  const report = {
    ...stats,
    durationMs: Date.now() - startedAt,
    config: result.config,
  };

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(result, null, 2), 'utf-8');
  await writeFile(reportPath, JSON.stringify(report, null, 2), 'utf-8');

  return result;
}
