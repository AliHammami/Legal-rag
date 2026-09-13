import { chunkCodePenal } from '../src/chunking/chunk-code-penal.js';

const startedAt = Date.now();
const result = await chunkCodePenal();

console.log(
  `Chunking terminé : ${result.stats.chunkCount} chunks (${result.stats.articleCount} articles, ${result.stats.multiChunkArticles} multi-chunks)`,
);
console.log(`Taille max chunk : ${result.stats.maxChunkSize}`);
console.log(`Durée : ${Date.now() - startedAt} ms`);
console.log('Sortie : data/processed/code-penal.chunks.json');
