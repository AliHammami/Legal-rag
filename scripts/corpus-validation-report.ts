import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { ALL_CORPUS_IDS, getCorpusConfig } from '../src/ingestion/corpus-config.js';
import type { PenalCodeIngestionResult } from '../src/ingestion/types.js';
import type { PenalCodeChunkingResult } from '../src/chunking/types.js';

const AUDIT_BASELINE: Record<
  string,
  { articles: number; gt2000: number }
> = {
  'code-penal': { articles: 1301, gt2000: 54 },
  'code-civil': { articles: 2899, gt2000: 22 },
  'code-du-travail': { articles: 11584, gt2000: 392 },
  'code-du-commerce': { articles: 7314, gt2000: 580 },
  'code-monetaire-et-financier': { articles: 5260, gt2000: 891 },
  'code-de-la-consommation': { articles: 2072, gt2000: 101 },
};

interface Row {
  corpusId: string;
  articles: number;
  unique: number;
  duplicates: number;
  empty: number;
  footerPollution: number;
  oversized: number;
  gt1500: number;
  gt2000: number;
  chunks: number;
  chunksOverMax: number;
  auditArticles: number;
  auditGt2000: number;
}

const rows: Row[] = [];

for (const corpusId of ALL_CORPUS_IDS) {
  const config = getCorpusConfig(corpusId);
  const ingestion = JSON.parse(
    await readFile(resolve(config.outputPath), 'utf-8'),
  ) as PenalCodeIngestionResult;
  const chunking = JSON.parse(
    await readFile(resolve(config.chunksOutputPath), 'utf-8'),
  ) as PenalCodeChunkingResult;
  const audit = AUDIT_BASELINE[corpusId]!;

  rows.push({
    corpusId,
    articles: ingestion.stats.articleCount,
    unique: ingestion.stats.uniqueArticleCount,
    duplicates: ingestion.stats.duplicateCount,
    empty: ingestion.stats.emptyArticles,
    footerPollution: ingestion.stats.footerPollutionArticles,
    oversized: ingestion.stats.oversizedArticles,
    gt1500: ingestion.stats.contentStats.gt1500,
    gt2000: ingestion.stats.contentStats.gt2000,
    chunks: chunking.stats.chunkCount,
    chunksOverMax: chunking.stats.chunksOverMax,
    auditArticles: audit.articles,
    auditGt2000: audit.gt2000,
  });
}

console.log(JSON.stringify({ generatedAt: new Date().toISOString(), rows }, null, 2));
