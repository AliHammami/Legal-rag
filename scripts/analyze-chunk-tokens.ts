import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import {
  analyzeAllCorpusChunkTokens,
  createEmbeddingTokenizer,
} from '../src/evaluation/chunk-token-analyzer.js';
import { buildChunkTokenAnalysisMarkdown } from '../src/evaluation/build-chunk-token-analysis-md.js';
import type { GlobalCorpusComparisonRow } from '../src/evaluation/chunk-token-analysis.types.js';
import { EvaluationError } from '../src/evaluation/evaluation.error.js';

const JSON_OUTPUT = resolve('data/evaluation/chunk-token-analysis.json');
const MD_OUTPUT = resolve('data/evaluation/chunk-token-analysis.md');

function pad(value: string, width: number): string {
  return value.length >= width ? value : value + ' '.repeat(width - value.length);
}

function formatComparisonTerminal(rows: GlobalCorpusComparisonRow[]): void {
  console.log('');
  console.log(
    [
      pad('Corpus', 24),
      pad('Chunks', 8),
      pad('Avg tok', 10),
      pad('P50', 8),
      pad('P95', 8),
      pad('P99', 8),
      pad('Max', 8),
    ].join(''),
  );
  console.log('-'.repeat(74));

  for (const row of rows) {
    console.log(
      [
        pad(row.codeName, 24),
        pad(String(row.chunkCount), 8),
        pad(String(row.avgTokens), 10),
        pad(String(row.p50Tokens), 8),
        pad(String(row.p95Tokens), 8),
        pad(String(row.p99Tokens), 8),
        pad(String(row.maxTokens), 8),
      ].join(''),
    );
  }
}

async function main(): Promise<void> {
  const tokenizer = createEmbeddingTokenizer();

  try {
    const report = await analyzeAllCorpusChunkTokens(tokenizer);

    await mkdir(dirname(JSON_OUTPUT), { recursive: true });
    await writeFile(JSON_OUTPUT, JSON.stringify(report, null, 2), 'utf-8');
    await writeFile(
      MD_OUTPUT,
      buildChunkTokenAnalysisMarkdown(report),
      'utf-8',
    );

    console.log('Chunk token analysis');
    console.log('');
    console.log(`Corpora: ${report.global.corpusCount}`);
    console.log(`Total chunks: ${report.global.totalChunks}`);
    console.log(`Total tokens: ${report.global.totalTokens}`);
    console.log(
      `Average tokens/chunk: ${report.global.averageTokensPerChunk}`,
    );
    console.log(
      `Global chars/token: ${report.global.globalCharsPerToken}`,
    );

    formatComparisonTerminal(report.global.comparison);

    console.log('');
    console.log('Files:');
    console.log(`- ${JSON_OUTPUT}`);
    console.log(`- ${MD_OUTPUT}`);
    console.log('');
    console.log('No chunking or RAG pipeline changes were made.');
  } finally {
    tokenizer.free();
  }
}

main().catch((error: unknown) => {
  if (error instanceof EvaluationError) {
    console.error(`Error [${error.code}]: ${error.message}`);
    process.exit(1);
  }

  console.error(error);
  process.exit(1);
});
