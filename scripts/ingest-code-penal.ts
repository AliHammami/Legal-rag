import { ingestCodePenal } from '../src/ingestion/ingest-code-penal.js';

const result = await ingestCodePenal();

console.log(`Ingestion terminée : ${result.stats.articleCount} articles`);
console.log(`Pages ignorées : ${result.stats.skippedPages}`);
console.log(`Durée : ${result.report?.durationMs} ms`);
console.log(`Sortie : data/processed/code-penal.articles.json`);
