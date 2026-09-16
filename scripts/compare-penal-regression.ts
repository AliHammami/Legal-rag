import { readFileSync } from 'node:fs';
import { ingestCodePenal } from '../src/ingestion/ingest-code-penal.js';
import type { PenalCodeIngestionResult } from '../src/ingestion/types.js';

async function main() {
  const baseline = JSON.parse(
    readFileSync('data/processed/code-penal.articles.json', 'utf-8'),
  ) as PenalCodeIngestionResult;

  const result = await ingestCodePenal({
    pdfPath: 'data/code-penal-13-09-2026.pdf',
    outputPath: 'data/processed/code-penal.regression.articles.json',
  });

  const base = new Map(baseline.articles.map((a) => [a.articleNumber, a]));
  let diffs = 0;

  for (const article of result.articles) {
    const expected = base.get(article.articleNumber);
    if (!expected) {
      console.log('missing', article.articleNumber);
      continue;
    }
    if (article.content !== expected.content) {
      diffs++;
      if (diffs <= 8) {
        console.log('DIFF', article.articleNumber);
        console.log('  new:', JSON.stringify(article.content.slice(0, 150)));
        console.log('  old:', JSON.stringify(expected.content.slice(0, 150)));
      }
    }
  }

  console.log('total diffs', diffs);
}

main().catch(console.error);
