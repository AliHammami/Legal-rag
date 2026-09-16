import type { PenalCodeIngestionResult } from './types.js';
import { ingestCorpus, type IngestCorpusOptions } from './ingest-corpus.js';

export interface IngestCodePenalOptions extends IngestCorpusOptions {}

const DEFAULT_PDF = 'data/code-penal-13-09-2026.pdf';
const DEFAULT_OUTPUT = 'data/processed/code-penal.articles.json';
const DEFAULT_REPORT = 'data/processed/ingestion-report.json';

export async function ingestCodePenal(
  options: IngestCodePenalOptions = {},
): Promise<PenalCodeIngestionResult> {
  return ingestCorpus('code-penal', {
    pdfPath: options.pdfPath ?? DEFAULT_PDF,
    outputPath: options.outputPath ?? DEFAULT_OUTPUT,
    reportPath: options.reportPath ?? DEFAULT_REPORT,
  });
}
