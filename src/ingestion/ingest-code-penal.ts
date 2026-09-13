import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import {
  cleanPageText,
  extractFooterDates,
  isBlankPage,
} from './clean-text.js';
import { extractPdfPages } from './extract-pdf.js';
import {
  pageLinesFromCleanedPages,
  parseStructure,
} from './parse-structure.js';
import type { PenalCodeIngestionResult } from './types.js';

export interface IngestCodePenalOptions {
  pdfPath?: string;
  outputPath?: string;
  reportPath?: string;
}

const DEFAULT_PDF = 'data/code-penal.pdf';
const DEFAULT_OUTPUT = 'data/processed/code-penal.articles.json';
const DEFAULT_REPORT = 'data/processed/ingestion-report.json';

export async function ingestCodePenal(
  options: IngestCodePenalOptions = {},
): Promise<PenalCodeIngestionResult> {
  const startedAt = Date.now();
  const pdfPath = resolve(options.pdfPath ?? DEFAULT_PDF);
  const outputPath = resolve(options.outputPath ?? DEFAULT_OUTPUT);
  const reportPath = resolve(options.reportPath ?? DEFAULT_REPORT);
  const sourceFile = options.pdfPath ?? DEFAULT_PDF;

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

    const { text, warnings: pageWarnings } = cleanPageText(page.text);
    warnings.push(...pageWarnings);

    if (isBlankPage(text)) {
      skippedPages++;
      continue;
    }

    cleanedPages.push({ pageNumber: page.pageNumber, text });
  }

  const pageLines = pageLinesFromCleanedPages(cleanedPages);
  const articles = parseStructure(pageLines, { sourceFile });

  const result: PenalCodeIngestionResult = {
    source: {
      file: sourceFile,
      type: 'pdf',
      producer: 'Apache FOP',
      pageCount: rawPages.length,
    },
    extractedAt: new Date().toISOString(),
    stats: {
      articleCount: articles.length,
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
