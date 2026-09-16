import { ALL_CORPUS_IDS } from '../src/ingestion/corpus-config.js';
import { chunkCorpus } from '../src/chunking/chunk-corpus.js';

const corpusId = process.argv[2];

if (!corpusId) {
  console.error('Usage: pnpm chunk:corpus <corpusId|all>');
  process.exit(1);
}

async function chunkOne(id: string) {
  const startedAt = Date.now();
  const result = await chunkCorpus({ corpusId: id });
  console.log(
    `${id}: ${result.stats.chunkCount} chunks (${result.stats.articleCount} articles, ${result.stats.multiChunkArticles} multi-chunks, ${result.stats.chunksOverMax} > max)`,
  );
  console.log(`  Dur?e : ${Date.now() - startedAt} ms`);
  return result;
}

if (corpusId === 'all') {
  for (const id of ALL_CORPUS_IDS) {
    await chunkOne(id);
  }
} else {
  await chunkOne(corpusId);
}
