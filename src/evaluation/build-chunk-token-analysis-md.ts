import type {
  ChunkTokenAnalysisReport,
  CorpusTokenAnalysis,
  GlobalCorpusComparisonRow,
} from './chunk-token-analysis.types.js';
import type { NumericSummary } from './chunk-token-stats.js';

function formatSummary(title: string, summary: NumericSummary): string {
  return [
    `### ${title}`,
    '',
    '| Metric | Value |',
    '|--------|------:|',
    `| min | ${summary.min} |`,
    `| mean | ${summary.mean} |`,
    `| P50 | ${summary.p50} |`,
    `| P75 | ${summary.p75} |`,
    `| P90 | ${summary.p90} |`,
    `| P95 | ${summary.p95} |`,
    `| P99 | ${summary.p99} |`,
    `| max | ${summary.max} |`,
    '',
  ].join('\n');
}

function formatComparisonTable(rows: GlobalCorpusComparisonRow[]): string {
  const header =
    '| Corpus | Chunks | Avg chars | P50 chars | P95 chars | Max chars | Avg tokens | P50 tokens | P95 tokens | P99 tokens | Max tokens | Avg chars/token | Global chars/token | >=1000 tok | >=1500 tok | >=2000 tok | >=2500 tok |';
  const separator =
    '|--------|-------:|----------:|----------:|----------:|----------:|-----------:|-----------:|-----------:|-----------:|-----------:|----------------:|-------------------:|-----------:|-----------:|-----------:|-----------:|';

  const body = rows
    .map(
      (row) =>
        `| ${row.codeName} | ${row.chunkCount} | ${row.avgChars} | ${row.p50Chars} | ${row.p95Chars} | ${row.maxChars} | ${row.avgTokens} | ${row.p50Tokens} | ${row.p95Tokens} | ${row.p99Tokens} | ${row.maxTokens} | ${row.avgCharsPerToken} | ${row.globalCharsPerToken} | ${row.gte1000Tokens.count} (${row.gte1000Tokens.percentage}%) | ${row.gte1500Tokens.count} (${row.gte1500Tokens.percentage}%) | ${row.gte2000Tokens.count} (${row.gte2000Tokens.percentage}%) | ${row.gte2500Tokens.count} (${row.gte2500Tokens.percentage}%) |`,
    )
    .join('\n');

  return [header, separator, body, ''].join('\n');
}

function formatCorpusSection(analysis: CorpusTokenAnalysis): string {
  const bucketLines = analysis.tokenBuckets
    .map(
      (bucket) =>
        `| ${bucket.label} | ${bucket.count} | ${bucket.percentage}% |`,
    )
    .join('\n');

  const thresholdLines = analysis.thresholds
    .map(
      (entry) =>
        `| >= ${entry.threshold} | ${entry.count} | ${entry.percentage}% |`,
    )
    .join('\n');

  const largestLines = analysis.largestChunks
    .map(
      (chunk) =>
        `| ${chunk.chunkId} | ${chunk.articleNumber} | ${chunk.chunkIndex} | ${chunk.chunkCount} | ${chunk.charCount} | ${chunk.tokenCount} | ${chunk.charsPerToken} |`,
    )
    .join('\n');

  const anomalyLines =
    analysis.anomalies.length === 0
      ? '_Aucune anomalie non bloquante._'
      : analysis.anomalies
          .map(
            (anomaly) =>
              `- **${anomaly.type}**${anomaly.chunkId ? ` (\`${anomaly.chunkId}\`)` : ''}: ${anomaly.message}`,
          )
          .join('\n');

  return [
    `## ${analysis.codeName} (\`${analysis.corpusId}\`)`,
    '',
    `- Fichier : \`${analysis.chunksPath}\``,
    `- Chunks : ${analysis.chunkCount}`,
    `- Total caract\u00E8res : ${analysis.totalCharacters}`,
    `- Total tokens : ${analysis.totalTokens}`,
    `- Ratio global caract\u00E8res/token : ${analysis.globalCharsPerToken}`,
    '',
    formatSummary('Caract\u00E8res', analysis.characters),
    formatSummary('Tokens', analysis.tokens),
    formatSummary('Ratio caract\u00E8res/token', analysis.charsPerToken),
    '### Distribution des tokens',
    '',
    '| Bucket | Count | Percentage |',
    '|--------|------:|-----------:|',
    bucketLines,
    '',
    '### Seuils tokeniques',
    '',
    '| Threshold | Count | Percentage |',
    '|-----------|------:|-----------:|',
    thresholdLines,
    '',
    '### Top 10 chunks (tokens)',
    '',
    '| chunkId | articleNumber | chunkIndex | chunkCount | charCount | tokenCount | chars/token |',
    '|---------|---------------|----------:|-----------:|----------:|-----------:|------------:|',
    largestLines,
    '',
    '### Anomalies',
    '',
    anomalyLines,
    '',
  ].join('\n');
}

function buildDescriptiveConclusion(report: ChunkTokenAnalysisReport): string {
  const lines: string[] = [
    '## Conclusion descriptive',
    '',
    `Analyse effectu\u00E9e sur ${report.global.corpusCount} corpus et ${report.global.totalChunks} chunks, avec le tokenizer \`${report.tokenizer.name}\` (\`${report.tokenizer.encoding}\`) pour le mod\u00E8le \`${report.tokenizer.model}\`.`,
    '',
    `Configuration de chunking actuelle : cible ${report.configuration.targetChars} caract\u00E8res, maximum ${report.configuration.maxChars} caract\u00E8res.`,
    '',
    `Ratio global caract\u00E8res/token sur l'ensemble des corpus : ${report.global.globalCharsPerToken}.`,
    '',
  ];

  for (const analysis of Object.values(report.corpora)) {
    const gte1000 =
      analysis.thresholds.find((entry) => entry.threshold === 1000)?.percentage ??
      0;
    const gte1500 =
      analysis.thresholds.find((entry) => entry.threshold === 1500)?.percentage ??
      0;
    const gte2000 =
      analysis.thresholds.find((entry) => entry.threshold === 2000)?.percentage ??
      0;

    lines.push(
      `- **${analysis.codeName}** : m\u00E9diane ${analysis.tokens.p50} tokens, P95 ${analysis.tokens.p95} tokens, max ${analysis.tokens.max} tokens ; ${gte1000}% des chunks >= 1000 tokens, ${gte1500}% >= 1500 tokens, ${gte2000}% >= 2000 tokens.`,
    );
  }

  lines.push(
    '',
    'Ces r\u00E9sultats constituent une photographie quantitative de la strat\u00E9gie actuelle en caract\u00E8res. Ils pourront servir \u00E0 d\u00E9cider si une strat\u00E9gie de chunking token-aware est pertinente, sans pr\u00E9supposer de changement imm\u00E9diat.',
    '',
  );

  return lines.join('\n');
}

export function buildChunkTokenAnalysisMarkdown(
  report: ChunkTokenAnalysisReport,
): string {
  return [
    '# Analyse tokens des chunks',
    '',
    `G\u00E9n\u00E9r\u00E9 le : ${report.generatedAt}`,
    '',
    '## Configuration',
    '',
    `- Tokenizer : \`${report.tokenizer.name}\``,
    `- Encoding : \`${report.tokenizer.encoding}\``,
    `- Mod\u00E8le cible : \`${report.tokenizer.model}\``,
    `- TARGET_SIZE : ${report.configuration.targetChars} caract\u00E8res`,
    `- MAX_SIZE : ${report.configuration.maxChars} caract\u00E8res`,
    '',
    '## Comparaison globale des corpus',
    '',
    formatComparisonTable(report.global.comparison),
    ...Object.values(report.corpora).map(formatCorpusSection),
    buildDescriptiveConclusion(report),
  ].join('\n');
}
