import { cleanPageText } from '../src/ingestion/clean-text.js';
import { extractPdfPages } from '../src/ingestion/extract-pdf.js';
import { pageLinesFromCleanedPages, ARTICLE_LINE_REGEX } from '../src/ingestion/parse-structure.js';

const pdfs = [
  ['code-penal', 'data/code-penal-13-09-2026.pdf'],
  ['code-civil', 'data/code-civil-19-06-2026.pdf'],
  ['code-travail', 'data/code-du-travail-16-09-2026.pdf'],
  ['code-commerce', 'data/code-du-commerce-16-09-2026.pdf'],
  ['code-monetaire', 'data/code-monetaire-et-financier-16-09-2026.pdf'],
  ['code-consommation', 'data/code-de-la-consommation-16-09-2026.pdf'],
];

async function main() {
  for (const [id, path] of pdfs) {
    const raw = await extractPdfPages(path);
    let footerPages = 0;
    let cleanedFooterPages = 0;
    const cleaned: Array<{ pageNumber: number; text: string }> = [];
    for (const p of raw) {
      if (/Dernière modification/.test(p.text)) footerPages++;
      const { text } = cleanPageText(p.text);
      if (/Dernière modification/.test(text)) cleanedFooterPages++;
      cleaned.push({ pageNumber: p.pageNumber, text });
    }
    const lines = pageLinesFromCleanedPages(cleaned);
    let partie = 0;
    let articleAny = 0;
    let articlePenal = 0;
    let bisTer = 0;
    for (const { line } of lines) {
      const t = line.trim();
      if (/^Partie l/.test(t)) partie++;
      if (/^Article /.test(t)) articleAny++;
      if (ARTICLE_LINE_REGEX.test(t)) articlePenal++;
      if (/^Article .*\b(bis|ter|quater|quinquies)\b/i.test(t)) bisTer++;
    }
    console.log(
      JSON.stringify({
        id,
        pages: raw.length,
        footerRaw: footerPages,
        footerAfterClean: cleanedFooterPages,
        footerRemovalRate:
          footerPages > 0
            ? `${((1 - cleanedFooterPages / footerPages) * 100).toFixed(1)}%`
            : 'N/A',
        partie,
        articleAny,
        articlePenal,
        penalCaptureRate:
          articleAny > 0
            ? `${((articlePenal / articleAny) * 100).toFixed(1)}%`
            : 'N/A',
        bisTerArticles: bisTer,
      }),
    );
  }
}

main().catch(console.error);
