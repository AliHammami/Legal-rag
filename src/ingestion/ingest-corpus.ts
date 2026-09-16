import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import {
  annotateOversizedArticles,
  computeContentStats,
} from './compute-content-stats.js';
import {
  buildLegifranceFooterRegex,
  cleanPageText,
  containsFooterPollution,
  extractFooterDates,
  isBlankPage,
} from './clean-text.js';
import { ALL_CORPUS_IDS, getCorpusConfig } from './corpus-config.js';
import { extractPdfPages } from './extract-pdf.js';
import {
  getLastParseStructureStats,
  pageLinesFromCleanedPages,
  parseStructure,
} from './parse-structure.js';
import type { PenalCodeIngestionResult } from './types.js';

export interface IngestCorpusOptions {
  pdfPath?: string;
  outputPath?: string;
  reportPath?: string;
}

export async function ingestCorpus(
  corpusId: string,
  options: IngestCorpusOptions = {},
): Promise<PenalCodeIngestionResult> {
  const config = getCorpusConfig(corpusId);
  const startedAt = Date.now();
  const pdfPath = resolve(options.pdfPath ?? config.pdfPath);
  const outputPath = resolve(options.outputPath ?? config.outputPath);
  const reportPath = resolve(
    options.reportPath ?? `data/processed/${corpusId}.ingestion-report.json`,
  );
  const sourceFile = options.pdfPath ?? config.pdfPath;
  const footerRegex = buildLegifranceFooterRegex(config.codeName);

  const rawPages = await extractPdfPages(pdfPath);
  const warnings: string[] = [];
  let skippedPages = 0;
  let lastModified: string | undefined;
  let generatedAt: string | undefined;

  const cleanedPages: Array<{ pageNumber: number; text: string }> = [];

  for (const page of rawPages) {
    const footerDates = extractFooterDates(page.text);
    lastModified ??= footerDates.lastModified;
    generatedAt ??= footerDates.generatedAt;

    const { text, warnings: pageWarnings } = cleanPageText(page.text, {
      footerRegex,
    });
    warnings.push(...pageWarnings);

    if (isBlankPage(text)) {
      skippedPages++;
      continue;
    }

    cleanedPages.push({ pageNumber: page.pageNumber, text });
  }

  const pageLines = pageLinesFromCleanedPages(cleanedPages);
  const articles = parseStructure(pageLines, {
    sourceFile,
    corpusId: config.corpusId,
    usePenalArticleMatcher: config.usePenalArticleMatcher,
  });

  for (const article of articles) {
    article.metadata.codeName = config.codeName;
    article.metadata.corpusId = config.corpusId;
  }

  const parseStats = getLastParseStructureStats();
  if (parseStats) {
    warnings.push(...parseStats.duplicateWarnings);
  }

  const oversizedArticles = annotateOversizedArticles(articles);
  let footerPollutionArticles = 0;
  for (const article of articles) {
    if (containsFooterPollution(article.content, config.codeName)) {
      footerPollutionArticles++;
    }
  }

  const uniqueArticleNumbers = new Set(articles.map((a) => a.articleNumber));
  const duplicateCount = parseStats?.duplicateWarnings.length ?? 0;
  const contentStats = computeContentStats(articles);

  const result: PenalCodeIngestionResult = {
    corpusId: config.corpusId,
    codeName: config.codeName,
    source: {
      file: sourceFile,
      type: 'pdf',
      producer: 'Apache FOP',
      pageCount: rawPages.length,
    },
    extractedAt: new Date().toISOString(),
    stats: {
      articleCount: articles.length,
      uniqueArticleCount: uniqueArticleNumbers.size,
      duplicateCount,
      emptyArticles: parseStats?.droppedEmptyArticles ?? 0,
      droppedSectionOnlyArticles: parseStats?.droppedSectionOnlyArticles ?? 0,
      oversizedArticles,
      footerPollutionArticles,
      contentStats,
      skippedPages,
      warnings: [...new Set(warnings)],
    },
    report: {
      lastModified,
      generatedAt,
      durationMs: Date.now() - startedAt,
    },
    articles,
  };

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(result, null, 2), 'utf-8');
  await writeFile(reportPath, JSON.stringify(result.report, null, 2), 'utf-8');

  return result;
}

export async function ingestAllCorpora(): Promise<
  Record<string, PenalCodeIngestionResult>
> {
  const results: Record<string, PenalCodeIngestionResult> = {};
  for (const corpusId of ALL_CORPUS_IDS) {
    results[corpusId] = await ingestCorpus(corpusId);
  }
  return results;
}
