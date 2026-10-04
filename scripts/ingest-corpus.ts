import { ALL_CORPUS_IDS } from '../src/ingestion/corpus-config.js';
import { ingestCorpus, ingestAllCorpora } from '../src/ingestion/ingest-corpus.js';

const corpusId = process.argv[2];

if (!corpusId) {
  console.error('Usage: pnpm ingest:corpus <corpusId|all>');
  process.exit(1);
}

if (corpusId === 'all') {
  const results = await ingestAllCorpora();
  for (const id of ALL_CORPUS_IDS) {
    const result = results[id]!;
    console.log(
      `${id}: ${result.stats.articleCount} articles (${result.stats.uniqueArticleCount} uniques)`,
    );
  }
} else {
  const result = await ingestCorpus(corpusId);
  console.log(`Ingestion terminée : ${result.stats.articleCount} articles`);
  console.log(`Uniques : ${result.stats.uniqueArticleCount}`);
  console.log(`Durée : ${result.report?.durationMs} ms`);
}
